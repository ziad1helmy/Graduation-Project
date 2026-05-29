import mongoose from 'mongoose';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import * as matchingService from './matching.service.js';
import * as rewardService from './reward.service.js';
import * as activityService from './activity.service.js';
import { ACTIVITY_TITLE_MAP } from '../constants/rewards.constants.js';
import { logger } from '../utils/logger.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';

/**
 * Donation Service - Manages donation lifecycle and eligibility
 */

/**
 * Validate donor eligibility for a specific request
 * @param {Object} donor - Donor document
 * @param {Object} request - Request document
 * @returns {Object} - {eligible: boolean, reason: string}
 */
export const validateEligibility = async (donor, request) => {
  try {
    // Use matching service to check eligibility
    const eligibility = await matchingService.checkEligibility(donor, request);
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
      status: { $ne: 'cancelled' },
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
    if (!['pending', 'scheduled', 'completed', 'cancelled'].includes(status)) {
      throw new Error('Invalid donation status');
    }

    const currentDonation = await Donation.findById(donationId);
    if (!currentDonation) {
      throw new Error('Donation not found');
    }

    if (currentDonation.status === status && status === 'completed') {
      return currentDonation;
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
        total:     [{ $count: 'n' }],
        completed: [{ $match: { status: 'completed' } }, { $count: 'n' }],
        pending:   [{ $match: { status: 'pending' } },   { $count: 'n' }],
        scheduled: [{ $match: { status: 'scheduled' } }, { $count: 'n' }],
        unitsSum:  [{ $match: { status: 'completed' } }, { $group: { _id: null, sum: { $sum: '$quantity' } } }],
      },
    },
  ]);

  return {
    totalDonations:     result?.total?.[0]?.n     ?? 0,
    completedDonations: result?.completed?.[0]?.n ?? 0,
    pendingDonations:   result?.pending?.[0]?.n   ?? 0,
    scheduledDonations: result?.scheduled?.[0]?.n ?? 0,
    totalUnitsDonated:  result?.unitsSum?.[0]?.sum ?? 0,
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

    const donation = await Donation.findByIdAndUpdate(
      donationId,
      { status: 'cancelled' },
      { returnDocument: 'after' }
    );

    // Log cancellation activity
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
        },
      })
      .catch((error) => logger.error('Activity log error', { message: error.message }));

    return donation;
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
