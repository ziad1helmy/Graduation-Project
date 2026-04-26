import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import * as matchingService from './matching.service.js';
import * as rewardService from './reward.service.js';

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
    const eligibility = matchingService.checkEligibility(donor, request);
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
    const request = await Request.findById(requestId);

    if (!donor || !request) {
      throw new Error('Donor or Request not found');
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

    const updateData = { status, ...data };

    // Validate dates
    if (data.scheduledDate) {
      const scheduledDate = new Date(data.scheduledDate);
      if (scheduledDate <= new Date()) {
        throw new Error('Scheduled date must be in the future');
      }
    }

    const donation = await Donation.findByIdAndUpdate(donationId, updateData, {
      new: true,
      runValidators: true,
    });

    // If completed, update donor's last donation date and award reward points
    if (status === 'completed') {
      await Donor.findByIdAndUpdate(donation.donorId, {
        lastDonationDate: new Date(),
      });

      // Fetch request to detect emergency urgency — fire-and-forget
      Request.findById(donation.requestId)
        .select('urgency')
        .then((req) => {
          const isEmergency = req?.urgency === 'critical';
          return rewardService.onDonationCompleted(donation.donorId, donation._id, isEmergency);
        })
        .catch((e) => console.error('[DonationService] reward trigger error:', e.message));
    }

    return donation;
  } catch (error) {
    throw error;
  }
};

/**
 * Get donation history for a donor
 * @param {string} donorId - Donor ID
 * @param {Object} filters - {status, skip, limit}
 * @returns {Object} - {donations, total}
 */
export const getDonationHistory = async (donorId, filters = {}) => {
  try {
    const { status, skip = 0, limit = 10 } = filters;

    const filter = { donorId };
    if (status) filter.status = status;

    const donations = await Donation.find(filter)
      .populate('requestId')
      .skip(parseInt(skip))
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
  try {
    const totalDonations = await Donation.countDocuments({ donorId });
    const completedDonations = await Donation.countDocuments({
      donorId,
      status: 'completed',
    });
    const pendingDonations = await Donation.countDocuments({
      donorId,
      status: 'pending',
    });
    const scheduledDonations = await Donation.countDocuments({
      donorId,
      status: 'scheduled',
    });

    // Calculate total units donated
    const donations = await Donation.find({ donorId, status: 'completed' });
    const totalUnitsDonated = donations.reduce((sum, d) => sum + d.quantity, 0);

    return {
      totalDonations,
      completedDonations,
      pendingDonations,
      scheduledDonations,
      totalUnitsDonated,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get donations for a request
 * @param {string} requestId - Request ID
 * @param {Object} filters - {status, skip, limit}
 * @returns {Object} - {donations, total}
 */
export const getDonationsForRequest = async (requestId, filters = {}) => {
  try {
    const { status, skip = 0, limit = 10 } = filters;

    const filter = { requestId };
    if (status) filter.status = status;

    const donations = await Donation.find(filter)
      .populate('donorId', 'fullName email phoneNumber location bloodType')
      .skip(parseInt(skip))
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
    const donation = await Donation.findByIdAndUpdate(
      donationId,
      { status: 'cancelled' },
      { new: true }
    );

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
      new: true,
    });

    return donation;
  } catch (error) {
    throw error;
  }
};
