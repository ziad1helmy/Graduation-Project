import response from '../utils/response.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import * as matchingService from '../services/matching.service.js';
import * as donationService from '../services/donation.service.js';
import * as notificationService from '../services/notification.service.js';

/**
 * Donor Controller - Handles donor-specific operations
 */

// Get donor profile
export const getProfile = async (req, res) => {
  try {
    const donor = await Donor.findById(req.user.userId).select('-password');
    if (!donor) {
      return response.error(res, 404, 'Donor profile not found');
    }
    response.success(res, 200, 'Donor profile retrieved successfully', donor);
  } catch (error) {
    response.error(res, 500, error.message);
  }
};

// Update donor profile
export const updateProfile = async (req, res) => {
  try {
    const { fullName, phoneNumber, gender, dateOfBirth, bloodType, location } = req.body;

    // Validate input
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phoneNumber) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return response.error(res, 400, 'Phone number must be 10 digits long');
      }
      updateData.phoneNumber = phoneNumber;
    }
    if (gender && ['male', 'female', 'not specified'].includes(gender)) {
      updateData.gender = gender;
    }
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (dob > new Date()) {
        return response.error(res, 400, 'Date of birth must be in the past');
      }
      updateData.dateOfBirth = dob;
    }
    if (bloodType && ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodType)) {
      updateData.bloodType = bloodType;
    }
    if (location) {
      updateData.location = location;
    }

    const donor = await Donor.findByIdAndUpdate(req.user.userId, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    response.success(res, 200, 'Donor profile updated successfully', donor);
  } catch (error) {
    response.error(res, 400, error.message);
  }
};

// Get all active requests
export const getRequests = async (req, res) => {
  try {
    const { type, urgency, skip = 0, limit = 10 } = req.query;

    // Build filter query
    const filter = {
      status: { $in: ['pending', 'in-progress'] },
    };

    if (type && ['blood', 'organ'].includes(type)) {
      filter.type = type;
    }
    if (urgency && ['low', 'medium', 'high', 'critical'].includes(urgency)) {
      filter.urgency = urgency;
    }

    const requests = await Request.find(filter)
      .populate('hospitalId', 'name hospitalName address contactNumber')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Request.countDocuments(filter);

    response.success(res, 200, 'Requests retrieved successfully', {
      requests,
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
    });
  } catch (error) {
    response.error(res, 500, error.message);
  }
};

// Get matching requests for this donor
export const getMatches = async (req, res) => {
  try {
    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    const { skip = 0, limit = 10 } = req.query;

    // Get matching requests using matching service
    const matches = await matchingService.findCompatibleRequests(donor._id);

    const paginatedMatches = matches
      .slice(parseInt(skip), parseInt(skip) + parseInt(limit));

    response.success(res, 200, 'Matching requests retrieved successfully', {
      matches: paginatedMatches,
      total: matches.length,
      skip: parseInt(skip),
      limit: parseInt(limit),
    });
  } catch (error) {
    response.error(res, 500, error.message);
  }
};

// Respond to a request (create a donation)
export const respondToRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { quantity } = req.body;

    // Validate request
    const request = await Request.findById(requestId);
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    // Get donor
    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    // Check if donor already responded
    const existingDonation = await Donation.findOne({
      donorId: req.user.userId,
      requestId,
      status: { $ne: 'cancelled' },
    });

    if (existingDonation) {
      return response.error(res, 400, 'You have already responded to this request');
    }

    // Validate eligibility
    const isEligible = await donationService.validateEligibility(donor, request);
    if (!isEligible.eligible) {
      return response.error(res, 400, isEligible.reason);
    }

    // Create donation
    const donation = await Donation.create({
      donorId: req.user.userId,
      requestId,
      quantity: quantity || 1,
      status: 'pending',
    });

    // Notify hospital
    await notificationService.notifyMatch(request.hospitalId, donation, request);

    response.success(res, 201, 'Response submitted successfully', donation);
  } catch (error) {
    response.error(res, 400, error.message);
  }
};

// Get donation history
export const getDonationHistory = async (req, res) => {
  try {
    const { status, skip = 0, limit = 10 } = req.query;

    const filter = { donorId: req.user.userId };
    if (status && ['pending', 'scheduled', 'completed', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    const donations = await Donation.find(filter)
      .populate('requestId', 'type bloodType organType urgency hospitalId')
      .populate({
        path: 'requestId',
        populate: { path: 'hospitalId', select: 'name hospitalName address' },
      })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Donation.countDocuments(filter);

    response.success(res, 200, 'Donation history retrieved successfully', {
      donations,
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
    });
  } catch (error) {
    response.error(res, 500, error.message);
  }
};

// Update availability status
export const updateAvailability = async (req, res) => {
  try {
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return response.error(res, 400, 'isAvailable must be a boolean value');
    }

    const donor = await Donor.findByIdAndUpdate(
      req.user.userId,
      { isAvailable },
      { new: true, runValidators: true }
    ).select('-password');

    response.success(res, 200, 'Availability status updated successfully', donor);
  } catch (error) {
    response.error(res, 400, error.message);
  }
};
