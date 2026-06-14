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
 * Shared implementation of "donor accepts request + create Donation QR".
 *
 * Both `POST /requests/:id/accept` and `POST /donor/respond/:requestId` delegate
 * here so the urgency/TTL rules, QR field names, eligibility guards, and
 * orphan-state validation cannot silently diverge between the two routes.
 *
 * The caller is responsible for:
 *   - Authorization (must already be a donor)
 *   - Building the response payload in the shape their route contract requires
 *
 * @returns {Promise<{ donation: Object, request: Object, qrToken: string, qrExpiresAt: Date }>}
 */
export const acceptRequest = async ({ donorId, requestId, quantity = 1 } = {}) => {
  if (!donorId) throw throwWithStatus(400, 'donorId is required');
  if (!requestId) throw throwWithStatus(400, 'requestId is required');

  const donor = await Donor.findById(donorId);
  if (!donor) throw throwWithStatus(404, 'Donor not found');

  const session = await mongoose.startSession();
  let donation;
  let acceptedRequest;

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

      try {
        validateTransition('request', request.status, 'accepted');
      } catch (transitionErr) {
        throw throwWithStatus(400, transitionErr.message);
      }

      if (request.acceptedBy) {
        throw throwWithStatus(409, 'Request has already been accepted');
      }

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

      const { qrToken, qrExpiresAt } = createDonationQrPayload(request);

      const [created] = await Donation.create([{
        donorId: donor._id,
        requestId: request._id,
        quantity: quantity || request.unitsNeeded || request.quantity || 1,
        status: 'pending',
        qrToken,
        qrExpiresAt,
        arrivalDeadline: qrExpiresAt,
        qrUsed: false,
      }], { session });
      donation = created;

      markRequestAsAccepted(request, donor, donation, qrExpiresAt);
      await request.save({ session });

      validateOrphanState('request', request, { donation });
      acceptedRequest = request;
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
  };
};
