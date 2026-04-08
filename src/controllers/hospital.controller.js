import response from '../utils/response.js';
import Hospital from '../models/Hospital.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import * as notificationService from '../services/notification.service.js';

/**
 * Hospital Controller - Handles hospital-specific operations
 */

// Get hospital profile
export const getProfile = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user.userId).select('-password');
    if (!hospital) {
      return response.error(res, 404, 'Hospital profile not found');
    }
    response.success(res, 200, 'Hospital profile retrieved successfully', hospital);
  } catch (error) {
    response.error(res, 500, error.message);
  }
};

// Update hospital profile
export const updateProfile = async (req, res) => {
  try {
    const { fullName, hospitalName, contactNumber, address, licenseNumber } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (hospitalName) updateData.hospitalName = hospitalName;
    if (contactNumber) updateData.contactNumber = contactNumber;
    if (address) updateData.address = address;
    if (licenseNumber) updateData.licenseNumber = licenseNumber;

    const hospital = await Hospital.findByIdAndUpdate(req.user.userId, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    response.success(res, 200, 'Hospital profile updated successfully', hospital);
  } catch (error) {
    response.error(res, 400, error.message);
  }
};

// Create a donation request
export const createRequest = async (req, res) => {
  try {
    const { type, bloodType, organType, urgency, requiredBy, quantity, notes } = req.body;

    // Validate required fields
    if (!type || !urgency || !requiredBy) {
      return response.error(res, 400, 'Type, urgency, and requiredBy are required');
    }

    if (!['blood', 'organ'].includes(type)) {
      return response.error(res, 400, 'Type must be blood or organ');
    }

    if (!['low', 'medium', 'high', 'critical'].includes(urgency)) {
      return response.error(res, 400, 'Urgency must be low, medium, high, or critical');
    }

    // Validate blood type for blood requests
    if (type === 'blood' && !bloodType) {
      return response.error(res, 400, 'Blood type is required for blood donation requests');
    }

    if (bloodType && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodType)) {
      return response.error(res, 400, 'Invalid blood type');
    }

    // Validate organ type for organ requests
    if (type === 'organ' && !organType) {
      return response.error(res, 400, 'Organ type is required for organ donation requests');
    }

    const requiredByDate = new Date(requiredBy);
    if (requiredByDate <= new Date()) {
      return response.error(res, 400, 'Required date must be in the future');
    }

    const hospital = await Hospital.findById(req.user.userId).select('contactNumber');
    if (!hospital) {
      return response.error(res, 404, 'Hospital profile not found');
    }

    if (!hospital.contactNumber) {
      return response.error(res, 400, 'Hospital contact number is required before creating a request');
    }

    const requestData = {
      hospitalId: req.user.userId,
      hospitalContact: hospital.contactNumber,
      type,
      urgency,
      requiredBy: requiredByDate,
      quantity: quantity || 1,
      notes: notes || '',
    };

    if (type === 'blood') {
      requestData.bloodType = bloodType;
    } else if (type === 'organ') {
      requestData.organType = organType;
    }

    const donRequest = await Request.create(requestData);

    // Populate hospital details
    await donRequest.populate('hospitalId', 'name hospitalName address contactNumber');

    response.success(res, 201, 'Donation request created successfully', donRequest);
  } catch (error) {
    response.error(res, 400, error.message);
  }
};

// Get hospital's requests
export const getRequests = async (req, res) => {
  try {
    const { status, type, skip = 0, limit = 10 } = req.query;

    const filter = { hospitalId: req.user.userId };

    if (status && ['pending', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    if (type && ['blood', 'organ'].includes(type)) {
      filter.type = type;
    }

    const requests = await Request.find(filter)
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

// Get specific request details
export const getRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await Request.findById(requestId).populate(
      'hospitalId',
      'name hospitalName address contactNumber'
    );

    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    // Verify hospital ownership
    if (request.hospitalId._id.toString() !== req.user.userId.toString()) {
      return response.error(res, 403, 'Unauthorized access to this request');
    }

    // Get donations for this request
    const donations = await Donation.find({ requestId }).populate(
      'donorId',
      'name email phoneNumber location bloodType lastDonationDate'
    );

    response.success(res, 200, 'Request details retrieved successfully', {
      request,
      donations,
      donationCount: donations.length,
    });
  } catch (error) {
    response.error(res, 500, error.message);
  }
};

// Update request status
export const updateRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return response.error(res, 400, 'Valid status is required');
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    // Verify hospital ownership
    if (request.hospitalId.toString() !== req.user.userId.toString()) {
      return response.error(res, 403, 'Unauthorized access to this request');
    }

    const updatedRequest = await Request.findByIdAndUpdate(
      requestId,
      { status },
      { new: true, runValidators: true }
    );

    response.success(res, 200, 'Request status updated successfully', updatedRequest);
  } catch (error) {
    response.error(res, 400, error.message);
  }
};

// Delete/Cancel request
export const deleteRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await Request.findById(requestId);
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    // Verify hospital ownership
    if (request.hospitalId.toString() !== req.user.userId.toString()) {
      return response.error(res, 403, 'Unauthorized access to this request');
    }

    // Cancel all donations associated with this request
    await Donation.updateMany(
      { requestId, status: { $ne: 'completed' } },
      { status: 'cancelled' }
    );

    // Delete the request
    await Request.findByIdAndUpdate(requestId, { status: 'cancelled' });

    response.success(res, 200, 'Request cancelled successfully');
  } catch (error) {
    response.error(res, 500, error.message);
  }
};

// Get donations for hospital's requests
export const getDonations = async (req, res) => {
  try {
    const { status, skip = 0, limit = 10 } = req.query;

    // Get all requests by this hospital
    const hospitalRequests = await Request.find({ hospitalId: req.user.userId }).select('_id');
    const requestIds = hospitalRequests.map((req) => req._id);

    const filter = { requestId: { $in: requestIds } };

    if (status && ['pending', 'scheduled', 'completed', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    const donations = await Donation.find(filter)
      .populate('donorId', 'name email phoneNumber location bloodType')
      .populate('requestId', 'type bloodType organType urgency')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Donation.countDocuments(filter);

    response.success(res, 200, 'Donations retrieved successfully', {
      donations,
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
    });
  } catch (error) {
    response.error(res, 500, error.message);
  }
};
