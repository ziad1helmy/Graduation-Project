import NotificationOutbox from '../models/NotificationOutbox.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import * as notificationService from '../services/notification.service.js';
import { logger } from '../utils/logger.js';

const MAX_ATTEMPTS_DEFAULT = 5;
const STALE_READY_THRESHOLD_MS = 2 * 60 * 1000;

export const recoverStaleReady = async () => {
  const cutoff = new Date(Date.now() - STALE_READY_THRESHOLD_MS);
  const result = await NotificationOutbox.updateMany(
    { status: 'ready', updatedAt: { $lt: cutoff } },
    { $set: { status: 'pending' } },
  );
  if (result.modifiedCount > 0) {
    logger.warn('Recovered stale outbox entries', { count: result.modifiedCount });
  }
  return result.modifiedCount;
};

/**
 * Atomically claim one pending outbox entry and mark it as 'ready' for processing.
 * This prevents multiple workers from processing the same entry concurrently.
 */
export const claimNextOutbox = async (maxAttempts = MAX_ATTEMPTS_DEFAULT) => {
  const outbox = await NotificationOutbox.findOneAndUpdate(
    { status: 'pending', attempts: { $lt: maxAttempts } },
    { $inc: { attempts: 1 }, $set: { status: 'ready' } },
    { returnDocument: 'after' }
  );

  return outbox;
};

const markSent = async (id) => {
  await NotificationOutbox.findByIdAndUpdate(id, { status: 'sent', lastError: null });
};

const markFailed = async (id, err, attempts, maxAttempts = MAX_ATTEMPTS_DEFAULT) => {
  const status = attempts >= maxAttempts ? 'failed' : 'pending';
  await NotificationOutbox.findByIdAndUpdate(id, { status, lastError: String(err?.message || err || 'unknown') });
};

/**
 * Process a single claimed outbox entry (must be status = 'ready')
 */
export const processOutboxEntry = async (outbox) => {
  if (!outbox) return null;
  try {
    const { _id, type } = outbox;

    if (type === 'match') {
      const request = await Request.findById(outbox.requestId);
      if (!request) throw new Error('Request not found for outbox entry');

      // Find the donation: prefer acceptedDonationId on request, fallback to donorId + requestId
      let donation = null;
      if (request.acceptedDonationId) {
        donation = await Donation.findById(request.acceptedDonationId);
      }
      if (!donation && Array.isArray(outbox.donorIds) && outbox.donorIds.length > 0) {
        donation = await Donation.findOne({ requestId: outbox.requestId, donorId: outbox.donorIds[0] });
      }
      if (!donation) throw new Error('Donation not found for match outbox');

      await notificationService.notifyMatch(outbox.userId, donation, request);
    } else if (type === 'request') {
      const request = await Request.findById(outbox.requestId);
      if (!request) throw new Error('Request not found for outbox entry');

      await notificationService.notifyRequest(outbox.donorIds || [], request);
    } else {
      throw new Error(`Unsupported outbox type: ${type}`);
    }

    await markSent(_id);
    return true;
  } catch (err) {
    logger.warn('Outbox processing error', { id: outbox._id, message: err.message });
    await markFailed(outbox._id, err, outbox.attempts || 0);
    return false;
  }
};

/**
 * Process pending outbox entries until none remain or until limit reached.
 * Returns statistics about processed entries.
 */
export const processPendingOutbox = async (opts = {}) => {
  const { maxIterations = 100, maxAttempts = MAX_ATTEMPTS_DEFAULT } = opts;
  await recoverStaleReady();
  let iterations = 0;
  let processed = 0;
  const stats = { processedSuccess: 0, processedFail: 0 };

  while (iterations < maxIterations) {
    const outbox = await claimNextOutbox(maxAttempts);
    if (!outbox) break;

    iterations += 1;
    const ok = await processOutboxEntry(outbox);
    processed += 1;
    if (ok) stats.processedSuccess += 1; else stats.processedFail += 1;
  }

  return stats;
};

export default { claimNextOutbox, processOutboxEntry, processPendingOutbox };
