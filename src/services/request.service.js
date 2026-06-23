import crypto from 'crypto';
import mongoose from 'mongoose';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import * as donationService from './donation.service.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { validateOrphanState, validateTransition } from '../utils/state-machine.js';
import { URGENCY_TIMEOUTS } from '../constants/request-timeout.constants.js';

const ACTIVE_DONATION_STATUSES = ['pending', 'scheduled'];

const throwWithStatus = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const resolveUrgencyKey = (request) => {
  if (request.isEmergency) return 'emergency';
  return request.urgency || 'medium';
};

/**
 * Issue a donation QR token whose expiry matches the request's urgency-based
 * arrival window. Centralizes the TTL calculation so all accept paths stay
 * in sync with `URGENCY_TIMEOUTS`.
 */
export const createDonationQrPayload = (request) => {
  const urgencyKey = resolveUrgencyKey(request);
  const timeouts = URGENCY_TIMEOUTS[urgencyKey] || URGENCY_TIMEOUTS.medium;
  const now = new Date();
  return {
    qrToken: crypto.randomBytes(32).toString('hex'),
    qrExpiresAt: new Date(now.getTime() + timeouts.arrivalWindowMs),
  };
};

const markRequestAsExpired = (request, now) => {
  try {
    validateTransition('request', request.status, 'expired');
  } catch (transitionErr) {
    throw new Error(transitionErr.message);
  }
  request.status = 'expired';
  request.expiredAt = now;
  request.qrToken = null;
  request.qrCreatedAt = null;
  request.qrExpiresAt = null;
};

const markRequestAsAccepted = (request, donor, donation, arrivalDeadline) => {
  request.status = 'accepted';
  request.acceptedBy = donor._id;
  request.acceptedByName = donor.fullName || null;
  request.acceptedByPhoneNumber = donor.phoneNumber || null;
  request.acceptedByBloodType = donor.bloodType || null;
  request.acceptedAt = new Date();
  request.acceptedDonationId = donation._id;
  request.arrivalDeadline = arrivalDeadline;
};

/**
 * Count total accepted units for a request from non-terminal donations.
 */
const countAcceptedUnits = async (requestId, session) => {
  const donations = await Donation.find({
    requestId,
    status: { $nin: ['cancelled', 'rejected', 'expired', 'abandoned', 'completed'] },
  }).session(session);
  return donations.reduce((sum, d) => sum + (d.quantity || 1), 0);
};

/**
 * Shared implementation of "donor accepts request + create Donation QR".
 *
 * Supports multi-donor acceptance: the request stays `pending` until
 * `unitsAccepted >= unitsNeeded`, then transitions to `accepted`.
 *
 * Both `POST /requests/:id/accept` and `POST /donor/respond/:requestId` delegate
 * here so the urgency/TTL rules, QR field names, eligibility guards, and
 * orphan-state validation cannot silently diverge between the two routes.
 *
 * The caller is responsible for:
 *   - Authorization (must already be a donor)
 *   - Building the response payload in the shape their route contract requires
 *
 * @returns {Promise<{ donation: Object, request: Object, qrToken: string, qrExpiresAt: Date, fullyAccepted: boolean }>}
 */
export const acceptRequest = async ({ donorId, requestId, quantity = 1 } = {}) => {
  if (!donorId) throw throwWithStatus(400, 'Donor ID is required');
  if (!requestId) throw throwWithStatus(400, 'Request ID is required');

  const donor = await Donor.findById(donorId);
  if (!donor) throw throwWithStatus(404, 'Donor not found');

  const session = await mongoose.startSession();
  let donation;
  let acceptedRequest;
  let fullyAccepted = false;

  try {
    await session.withTransaction(async () => {
      const request = await Request.findById(requestId).session(session);
      if (!request) throw throwWithStatus(404, 'Request not found');

      // Guard: requiredBy passed between the route check and the transaction.
      const now = new Date();
      if (request.requiredBy && request.requiredBy <= now && request.status === 'pending') {
        markRequestAsExpired(request, now);
        await request.save({ session });
        throw throwWithStatus(400, 'Request has expired — the deadline has passed');
      }

      // Only pending requests accept new donor responses.
      if (!['pending'].includes(request.status)) {
        throw throwWithStatus(400, 'Request is no longer accepting responses');
      }

      // Each donor can only respond once.
      const existingDonation = await Donation.findOne({
        donorId: donor._id,
        requestId: request._id,
        status: { $in: ACTIVE_DONATION_STATUSES },
      }).session(session);

      if (existingDonation) {
        throw throwWithStatus(400, 'You have already responded to this request');
      }

      const eligibility = await donationService.validateEligibility(donor, request);
      if (!eligibility.eligible) {
        throw throwWithStatus(400, eligibility.reason || ELIGIBILITY_KEYS.DONOR_NOT_ELIGIBLE);
      }

      const donationQuantity = quantity || 1;

      // Atomically claim units — this is the concurrency guard.
      // $inc is atomic within the transaction; write conflicts on the same
      // document cause a retry, which re-reads the post-commit state.
      const claimed = await Request.findOneAndUpdate(
        { _id: request._id, status: 'pending' },
        { $inc: { unitsAccepted: donationQuantity } },
        { new: true, session },
      );

      if (!claimed) {
        throw throwWithStatus(400, 'Request is no longer accepting responses');
      }

      if (claimed.unitsAccepted > claimed.unitsNeeded) {
        // Over-accepted — rollback the increment and reject.
        await Request.findOneAndUpdate(
          { _id: request._id },
          { $inc: { unitsAccepted: -donationQuantity } },
          { session },
        );
        throw throwWithStatus(
          400,
          `Request only needs ${claimed.unitsNeeded} units — cannot accept ${donationQuantity} more`,
        );
      }

      const { qrToken, qrExpiresAt } = createDonationQrPayload(request);

      const [created] = await Donation.create([{
        donorId: donor._id,
        requestId: request._id,
        quantity: donationQuantity,
        status: 'pending',
        qrToken,
        qrExpiresAt,
        arrivalDeadline: qrExpiresAt,
        qrUsed: false,
      }], { session });
      donation = created;

      // Use the claimed document for status tracking.
      const isFullyFulfilled = claimed.unitsAccepted >= claimed.unitsNeeded;

      if (isFullyFulfilled) {
        validateTransition('request', claimed.status, 'accepted');
        claimed.status = 'accepted';
        claimed.arrivalDeadline = qrExpiresAt;
        fullyAccepted = true;
      }

      // Set first-acceptor backward-compat fields if this is the first donor.
      if (!claimed.acceptedBy) {
        claimed.acceptedBy = donor._id;
        claimed.acceptedByName = donor.fullName || null;
        claimed.acceptedByPhoneNumber = donor.phoneNumber || null;
        claimed.acceptedByBloodType = donor.bloodType || null;
        claimed.acceptedDonationId = donation._id;
        claimed.acceptedAt = new Date();
      }

      await claimed.save({ session });

      // Orphan check — only for accepted status since it asserts acceptedDonationId.
      if (claimed.status === 'accepted') {
        validateOrphanState('request', claimed, { donation });
      }
      acceptedRequest = claimed;
    });
  } catch (error) {
    if (error?.code === 11000 || (typeof error?.message === 'string' && error.message.includes('E11000'))) {
      throw throwWithStatus(409, 'You have already responded to this request');
    }
    throw error;
  } finally {
    session.endSession();
  }

  return {
    donation,
    request: acceptedRequest,
    qrToken: donation.qrToken,
    qrExpiresAt: donation.qrExpiresAt,
    fullyAccepted,
  };
};
