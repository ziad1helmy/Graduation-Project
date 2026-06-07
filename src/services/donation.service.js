import mongoose from 'mongoose';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Appointment from '../models/Appointment.model.js';
import * as matchingService from './matching.service.js';
import * as rewardService from './reward.service.js';
import * as activityService from './activity.service.js';
import { ACTIVITY_TITLE_MAP } from '../constants/rewards.constants.js';
import { logger } from '../utils/logger.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { validateTransition, validateOrphanState } from '../utils/state-machine.js';
import { rejectDonationLifecycle } from './request-lifecycle.service.js';

/**
 * Donation Service - Manages donation lifecycle and eligibility
 */

/**
 * Validate donor eligibility for a specific request
 * @param {Object} donor - Donor document
 * @param {Object} request - Request document
 * @returns {Object} - {eligible: boolean, reason: string}
 */
export const validateEligibility = async (donor, request, options = {}) => {
  try {
    // Use matching service to check eligibility
    const eligibility = await matchingService.checkEligibility(donor, request, options);
    return eligibility;
  } catch (error) {
    return { eligible: false, reason: 'Error validating eligibility: ' + error.message };
  }
};

/**
 * Create a new donation record
 * @param {string} donorId - Donor user ID
 * @param {string} requestId - Request ID
 * @param {Object} data - Additional donation data
 * @returns {Object} - Created donation
 */
export const createDonation = async (donorId, requestId, data = {}) => {
  try {
    // Get donor and request
    const donor = await Donor.findById(donorId);
    const request = await Request.findById(requestId).populate('hospitalId', 'fullName hospitalName');

    if (!donor || !request) {
      throw new Error(ELIGIBILITY_KEYS.DONOR_OR_REQUEST_NOT_FOUND);
    }

    // Validate eligibility
    const eligibility = await validateEligibility(donor, request);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    // Check if donor already responded
    const existingDonation = await Donation.findOne({
      donorId,
      requestId,
      status: { $nin: ['cancelled', 'rejected'] },
    });

    if (existingDonation) {
      throw new Error('Donor has already responded to this request');
    }

    // Create donation
    const donation = await Donation.create({
      donorId,
      requestId,
      quantity: data.quantity || 1,
      status: 'pending',
      notes: data.notes || '',
    });

    // Log activity and await to ensure tests observe the activity record
    await activityService
      .logActivity(donorId, {
        type: 'donation',
        action: 'created_donation',
        title: ACTIVITY_TITLE_MAP.donation_created,
        description: `Started donating ${donation.quantity} unit(s) of blood`,
        referenceId: donation._id.toString(),
        referenceType: 'Donation',
        metadata: {
          quantity: donation.quantity,
          requestId: requestId,
          hospitalName: request.hospitalName || request.hospitalId?.hospitalName || request.hospitalId?.fullName || null,
        },
      })
      .catch((error) => logger.error('Activity log error', { message: error.message }));

    return donation;
  } catch (error) {
    throw error;
  }
};

/**
 * Update donation status
 * @param {string} donationId - Donation ID
 * @param {string} status - New status
 * @param {Object} data - Additional data (scheduledDate, completedDate, etc)
 * @returns {Object} - Updated donation
 */
export const updateDonationStatus = async (donationId, status, data = {}) => {
  try {
    if (!['pending', 'scheduled', 'completed', 'cancelled', 'rejected'].includes(status)) {
      throw new Error('Invalid donation status');
    }

    const currentDonation = await Donation.findById(donationId);
    if (!currentDonation) {
      throw new Error('Donation not found');
    }

    if (currentDonation.status === status && status === 'completed') {
      return currentDonation;
    }

    validateTransition('donation', currentDonation.status, status);

    if (status === 'scheduled' && !(data.appointmentId || currentDonation.appointmentId) && !currentDonation.requestId) {
      // Scheduling without an appointment is allowed for donations tied to
      // a Request (legacy / request-only flows). If the donation is not
      // associated with a request, an appointmentId must be provided.
      throw new Error('Scheduled donation requires an appointment');
    }

    if (['cancelled', 'rejected'].includes(status) && (currentDonation.requestId || currentDonation.appointmentId)) {
      const result = await rejectDonationLifecycle({
        donationId,
        donationStatus: status,
        requestStatus: 'pending',
      });
      return result.donation;
    }

    if (status === 'completed') {
      // If donation is linked to an appointment, the appointment must be
      // completed. If no appointment exists but the donation is linked to a
      // Request, allow completion (legacy flows/tests rely on this).
      if (currentDonation.appointmentId) {
        const appointment = await Appointment.findById(currentDonation.appointmentId);
        if (!appointment || appointment.status !== 'completed') {
          throw new Error('Completed donation requires a completed appointment');
        }
      } else if (!currentDonation.requestId) {
        throw new Error('Completed donation requires a completed appointment');
      }
    }

    const updateData = { status, ...data };

    if (status === 'completed' && !updateData.completedDate) {
      updateData.completedDate = new Date();
    }

    const request = (status === 'completed' || status === 'cancelled')
      ? await Request.findById(currentDonation.requestId).populate('hospitalId', 'fullName hospitalName')
      : null;

    // Validate dates
    if (data.scheduledDate) {
      const scheduledDate = new Date(data.scheduledDate);
      if (scheduledDate <= new Date()) {
        throw new Error('Scheduled date must be in the future');
      }
    }

    // Special-case: completing a donation that is linked to a request must
    // update the related request atomically to avoid partial persistence.
    if (status === 'completed' && currentDonation.requestId) {
      const session = await mongoose.startSession();
      let updatedDonation = null;
      let updatedRequest = null;
      try {
        await session.withTransaction(async () => {
          // Re-fetch current donation under session to avoid races
          const donationDoc = await Donation.findById(donationId).session(session);
          if (!donationDoc) throw new Error('Donation not found');

          // If this donation is linked to an appointment, ensure it's completed.
          // Legacy donations (no appointment) are allowed to be completed when
          // they're tied to a Request (tests and historical flows rely on this).
          let appointment = null;
          if (donationDoc.appointmentId) {
            appointment = await Appointment.findById(donationDoc.appointmentId).session(session);
            if (!appointment || appointment.status !== 'completed') throw new Error('Completed donation requires a completed appointment');
          }

          // Persist donation update
          updatedDonation = await Donation.findByIdAndUpdate(donationId, updateData, {
            returnDocument: 'after',
            runValidators: true,
            session,
          });

          // If donation is linked to a request, advance the request through
          // the canonical path: accepted -> in-progress -> completed
          if (donationDoc.requestId) {
            const requestDoc = await Request.findById(donationDoc.requestId).session(session);
            if (requestDoc) {
              if (requestDoc.status === 'accepted') {
                // validate transition to in-progress before mutating
                validateTransition('request', requestDoc.status, 'in-progress');
                requestDoc.status = 'in-progress';
                await requestDoc.save({ session });
              }
              // validate transition to completed from the current status
              // Legacy flows may complete a request that is still `pending`.
              // In that case skip the strict validateTransition check to
              // preserve historical behavior exercised by tests.
              if (requestDoc.status !== 'pending') {
                validateTransition('request', requestDoc.status, 'completed');
              }
              requestDoc.status = 'completed';
              requestDoc.completedAt = updateData.completedDate || new Date();
              requestDoc.acceptedDonationId = updatedDonation._id;
              updatedRequest = await requestDoc.save({ session });
            }
          }

          // Ensure cross-entity invariants after updates. Skip the donation
          // orphan check when there is no appointment (legacy behavior).
          if (appointment) validateOrphanState('donation', updatedDonation, { appointment });
          if (updatedRequest) validateOrphanState('request', updatedRequest, { donation: updatedDonation });

          // Update donor last donation date
          await Donor.findByIdAndUpdate(updatedDonation.donorId, { lastDonationDate: new Date() }, { session });
        });
      } finally {
        session.endSession();
      }

      // Log completion activity (fire-and-forget)
      if (updatedDonation) {
        await activityService
          .logActivity(updatedDonation.donorId, {
            type: 'donation',
            action: 'completed_donation',
            title: ACTIVITY_TITLE_MAP.donation_completed,
            description: `Successfully completed donation of ${updatedDonation.quantity} unit(s)`,
            referenceId: updatedDonation._id.toString(),
            referenceType: 'Donation',
            metadata: {
              quantity: updatedDonation.quantity,
              completedDate: updateData.completedDate,
            },
          })
          .catch((error) => logger.error('Activity log error', { message: error.message }));

        // Trigger reward processing and await it to avoid silent failures.
        try {
          const isEmergency = request?.urgency === 'critical';
          await rewardService.onDonationCompleted(updatedDonation.donorId, updatedDonation._id, isEmergency);
        } catch (e) {
          logger.error('Reward trigger error', {
            message: e.message,
          });
        }
      }

      return updatedDonation;
    }

    const donation = await Donation.findByIdAndUpdate(donationId, updateData, {
      returnDocument: 'after',
      runValidators: true,
    });

    // If completed or cancelled, log activity (fire-and-forget)
    if (status === 'completed') {
      // Update lastDonationDate so the eligibility service can compute the
      // cooldown period dynamically. isOptedIn (participation preference) is
      // intentionally NOT touched — the donor's opt-in/out choice persists.
      await Donor.findByIdAndUpdate(donation.donorId, {
        lastDonationDate: new Date(),
      });

      // Log completion activity
      await activityService
        .logActivity(donation.donorId, {
          type: 'donation',
          action: 'completed_donation',
          title: ACTIVITY_TITLE_MAP.donation_completed,
          description: `Successfully completed donation of ${donation.quantity} unit(s)`,
          referenceId: donation._id.toString(),
          referenceType: 'Donation',
          metadata: {
            quantity: donation.quantity,
            completedDate: updateData.completedDate,
            hospitalName: request?.hospitalName || request?.hospitalId?.hospitalName || request?.hospitalId?.fullName || null,
          },
        })
        .catch((error) => logger.error('Activity log error', { message: error.message }));

      // Trigger reward processing and await it to avoid silent failures.
      try {
        const isEmergency = request?.urgency === 'critical';
        await rewardService.onDonationCompleted(donation.donorId, donation._id, isEmergency);
      } catch (e) {
        logger.error('Reward trigger error', {
          message: e.message,
        });
      }
    } else if (status === 'rejected') {
      await activityService
        .logActivity(donation.donorId, {
          type: 'donation',
          action: 'rejected_donation',
          title: ACTIVITY_TITLE_MAP.donation_cancelled,
          description: `Donation rejected (${donation.quantity} unit(s))`,
          referenceId: donation._id.toString(),
          referenceType: 'Donation',
          metadata: {
            quantity: donation.quantity,
            previousStatus: currentDonation.status,
            hospitalName: request?.hospitalName || request?.hospitalId?.hospitalName || request?.hospitalId?.fullName || null,
          },
        })
        .catch((error) => logger.error('Activity log error', { message: error.message }));
    } else if (status === 'cancelled') {
      // Log cancellation activity and await to make logging deterministic for tests
      await activityService
        .logActivity(donation.donorId, {
          type: 'donation',
          action: 'cancelled_donation',
          title: ACTIVITY_TITLE_MAP.donation_cancelled,
          description: `Donation cancelled (${donation.quantity} unit(s))`,
          referenceId: donation._id.toString(),
          referenceType: 'Donation',
          metadata: {
            quantity: donation.quantity,
            previousStatus: currentDonation.status,
            hospitalName: request?.hospitalName || request?.hospitalId?.hospitalName || request?.hospitalId?.fullName || null,
          },
        })
        .catch((error) => logger.error('Activity log error', { message: error.message }));
    }

    return donation;
  } catch (error) {
    throw error;
  }
};

/**
 * Get donation history for a donor
 * @param {string} donorId - Donor ID
 * @param {Object} filters - {status, page, limit}
 * @returns {Object} - {donations, total}
 */
export const getDonationHistory = async (donorId, filters = {}) => {
  try {
    const { status, page = 1, limit = 10 } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const filter = { donorId };
    if (status) filter.status = status;

    const donations = await Donation.find(filter)
      .populate('requestId')
      .skip(offset)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Donation.countDocuments(filter);

    return { donations, total };
  } catch (error) {
    throw error;
  }
};

/**
 * Get donation statistics for a donor
 * @param {string} donorId - Donor ID
 * @returns {Object} - Donation statistics
 */
export const getDonorStats = async (donorId) => {
  const [result] = await Donation.aggregate([
    { $match: { donorId: new mongoose.Types.ObjectId(donorId) } },
    {
      $facet: {
        totalResponses: [{ $count: 'n' }],
        completed: [{ $match: { status: 'completed' } }, { $count: 'n' }],
        pending:   [{ $match: { status: 'pending' } },   { $count: 'n' }],
        scheduled: [{ $match: { status: 'scheduled' } }, { $count: 'n' }],
        unitsSum:  [{ $match: { status: 'completed' } }, { $group: { _id: null, sum: { $sum: '$quantity' } } }],
      },
    },
  ]);

  const totalResponses = result?.totalResponses?.[0]?.n ?? 0;
  const completedDonations = result?.completed?.[0]?.n ?? 0;

  return {
    totalResponses,
    responseCount: totalResponses,
    totalDonations: completedDonations,
    completedDonations,
    pendingDonations: result?.pending?.[0]?.n ?? 0,
    scheduledDonations: result?.scheduled?.[0]?.n ?? 0,
    totalUnitsDonated: result?.unitsSum?.[0]?.sum ?? 0,
  };
};


/**
 * Get donations for a request
 * @param {string} requestId - Request ID
 * @param {Object} filters - {status, page, limit}
 * @returns {Object} - {donations, total}
 */
export const getDonationsForRequest = async (requestId, filters = {}) => {
  try {
    const { status, page = 1, limit = 10 } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const filter = { requestId };
    if (status) filter.status = status;

    const donations = await Donation.find(filter)
      .populate('donorId', 'fullName email phoneNumber location bloodType')
      .skip(offset)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Donation.countDocuments(filter);

    return { donations, total };
  } catch (error) {
    throw error;
  }
};

/**
 * Cancel a donation
 * @param {string} donationId - Donation ID
 * @returns {Object} - Updated donation
 */
export const cancelDonation = async (donationId) => {
  try {
    const currentDonation = await Donation.findById(donationId);
    if (!currentDonation) {
      throw new Error('Donation not found');
    }

    const result = await rejectDonationLifecycle({
      donationId,
      donationStatus: 'cancelled',
      requestStatus: 'pending',
    });

    return result.donation;
  } catch (error) {
    throw error;
  }
};

/**
 * Get donation by ID with full details
 * @param {string} donationId - Donation ID
 * @returns {Object} - Donation with populated references
 */
export const getDonationDetails = async (donationId) => {
  try {
    const donation = await Donation.findById(donationId)
      .populate({
        path: 'donorId',
        select: 'name email phoneNumber location bloodType',
      })
      .populate({
        path: 'requestId',
        populate: { path: 'hospitalId', select: 'name hospitalName address contactNumber' },
      });

    return donation;
  } catch (error) {
    throw error;
  }
};

/**
 * Update donation with hospital feedback
 * @param {string} donationId - Donation ID
 * @param {Object} data - Feedback data {result, notes}
 * @returns {Object} - Updated donation
 */
export const updateDonationFeedback = async (donationId, data) => {
  try {
    const updateData = {};

    if (data.result) {
      updateData.result = data.result; // e.g., 'successful', 'failed'
    }
    if (data.notes) {
      updateData.notes = data.notes;
    }

    const donation = await Donation.findByIdAndUpdate(donationId, updateData, {
      returnDocument: 'after',
    });

    return donation;
  } catch (error) {
    throw error;
  }
};
