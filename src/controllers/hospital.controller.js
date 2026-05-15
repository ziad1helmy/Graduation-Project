import response from '../utils/response.js';
import mongoose from 'mongoose';
import Hospital from '../models/Hospital.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import * as notificationService from '../services/notification.service.js';
import * as matchingService from '../services/matching.service.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import HospitalSettings from '../models/HospitalSettings.model.js';
import * as adminService from '../services/admin.service.js';
import * as hospitalService from '../services/hospital.service.js';
import { validateCreateHospitalByAdminBody } from '../validation/admin.validation.js';

const normalizeLocationInput = (location) => {
  if (!location || typeof location !== 'object') return null;

  const normalized = {};
  if (location.city) normalized.city = location.city;
  if (location.governorate || location.governrate) {
    normalized.governorate = location.governorate || location.governrate;
  }

  const rawLat = location.coordinates?.lat ?? location.latitude ?? location.lat;
  const rawLng = location.coordinates?.lng ?? location.longitude ?? location.lng;
  const lat = rawLat === '' || rawLat === undefined || rawLat === null ? undefined : Number(rawLat);
  const lng = rawLng === '' || rawLng === undefined || rawLng === null ? undefined : Number(rawLng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    normalized.coordinates = { lat, lng };
    normalized.lastUpdated = new Date();
  }

  return Object.keys(normalized).length ? normalized : null;
};

/**
 * Hospital Controller - Handles hospital-specific operations
 */

// Get hospital profile
export const getProfile = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.user.userId).select('-password');
    if (!hospital) {
      return response.error(res, 404, 'Hospital profile not found');
    }
    response.success(res, 200, 'Hospital profile retrieved successfully', hospital);
  } catch (error) {
    next(error);
  }
};

// Update hospital profile
export const updateProfile = async (req, res, next) => {
  try {
    const { fullName, hospitalName, contactNumber, address, licenseNumber, location } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (hospitalName) updateData.hospitalName = hospitalName;
    if (contactNumber) updateData.contactNumber = contactNumber;
    if (address) {
      updateData.address = {
        ...address,
        ...(address.governrate && !address.governorate ? { governorate: address.governrate } : {}),
      };
      delete updateData.address.governrate;
    }
    if (licenseNumber) updateData.licenseNumber = licenseNumber;
    const normalizedLocation = normalizeLocationInput(location);
    if (normalizedLocation) updateData.location = normalizedLocation;

    const hospital = await Hospital.findByIdAndUpdate(req.user.userId, updateData, {
      returnDocument: 'after',
      runValidators: true,
    }).select('-password');

    response.success(res, 200, 'Hospital profile updated successfully', hospital);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

// Create a donation request
export const createRequest = async (req, res, next) => {
  try {
    const {
      type,
      bloodType,
      organType,
      urgency,
      requiredBy,
      quantity,
      unitsNeeded,
      patientType,
      contactNumber,
      isEmergency,
      notes,
    } = req.body;

    // Validate required fields
    if (!type || (!urgency && isEmergency !== true) || !requiredBy) {
      return response.error(res, 400, 'Type, urgency or emergency flag, and requiredBy are required');
    }

    if (!['blood', 'organ'].includes(type)) {
      return response.error(res, 400, 'Type must be blood or organ');
    }

    if (!['low', 'medium', 'high', 'critical'].includes(urgency)) {
      return response.error(res, 400, 'Urgency must be low, medium, high, or critical');
    }

    if (type === 'blood' && !bloodType) {
      return response.error(res, 400, 'Blood type is required for blood donation requests');
    }

    if (bloodType && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodType)) {
      return response.error(res, 400, 'Invalid blood type');
    }

    if (type === 'organ' && !organType) {
      return response.error(res, 400, 'Organ type is required for organ donation requests');
    }

    const requiredByDate = new Date(requiredBy);
    if (requiredByDate <= new Date()) {
      return response.error(res, 400, 'Required date must be in the future');
    }

    const hospital = await Hospital.findById(req.user.userId).select('contactNumber location fullName hospitalName');
    if (!hospital) {
      return response.error(res, 404, 'Hospital profile not found');
    }

    if (!hospital.contactNumber) {
      return response.error(res, 400, 'Hospital contact number is required before creating a request');
    }

    const resolvedUnits = Number(unitsNeeded ?? quantity ?? 1);
    const resolvedUrgency = isEmergency === true ? 'critical' : urgency;

    const requestData = {
      hospitalId: req.user.userId,
      hospitalContact: hospital.contactNumber,
      contactNumber: contactNumber || hospital.contactNumber,
      type,
      urgency: resolvedUrgency,
      requiredBy: requiredByDate,
      quantity: Number.isFinite(resolvedUnits) && resolvedUnits > 0 ? resolvedUnits : 1,
      unitsNeeded: Number.isFinite(resolvedUnits) && resolvedUnits > 0 ? resolvedUnits : 1,
      patientType: patientType || null,
      isEmergency: isEmergency === true || resolvedUrgency === 'critical',
      notes: notes || '',
    };

    // Snapshot hospital location and display name at time of request
    requestData.locationHospital = {
      latitude: hospital?.location?.coordinates?.lat,
      longitude: hospital?.location?.coordinates?.lng,
    };
    requestData.hospitalLocation = {
      lat: hospital?.location?.coordinates?.lat,
      lng: hospital?.location?.coordinates?.lng,
    };
    if (Number.isFinite(hospital?.location?.coordinates?.lat) && Number.isFinite(hospital?.location?.coordinates?.lng)) {
      requestData.hospitalLocationGeo = {
        type: 'Point',
        coordinates: [hospital.location.coordinates.lng, hospital.location.coordinates.lat],
      };
    }
    requestData.hospitalName = hospital?.hospitalName || hospital?.fullName;

    if (type === 'blood') {
      requestData.bloodType = bloodType;
    } else if (type === 'organ') {
      requestData.organType = organType;
    }

    const donRequest = await Request.create(requestData);
    await donRequest.populate('hospitalId', 'fullName hospitalName address contactNumber');

    if (requestData.isEmergency) {
      const compatibleDonors = await matchingService.findCompatibleDonors(donRequest._id);
      const donorIds = compatibleDonors.map(({ donor }) => donor._id);

      if (donorIds.length > 0) {
        await notificationService.notifyRequest(donorIds, donRequest);
      }
    }

    response.success(res, 201, 'Donation request created successfully', donRequest);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

// Get hospital's requests — supports ?page=1&limit=10 or legacy ?skip=0&limit=10
export const getRequests = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const { skip, limit, page } = parsePagination(req.query);

    const filter = { hospitalId: req.user.userId };

    if (status && ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'].includes(status)) {
      filter.status = status;
    }
    if (type && ['blood', 'organ'].includes(type)) {
      filter.type = type;
    }

    const [requests, total] = await Promise.all([
      Request.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Request.countDocuments(filter),
    ]);

    response.success(res, 200, 'Requests retrieved successfully', {
      requests,
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

// Get specific request details
export const getRequestDetails = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await Request.findById(requestId).populate(
      'hospitalId',
      'fullName hospitalName address contactNumber'
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
      'fullName email phoneNumber location bloodType lastDonationDate'
    );

    response.success(res, 200, 'Request details retrieved successfully', {
      request,
      donations,
      donationCount: donations.length,
    });
  } catch (error) {
    next(error);
  }
};

// Update request status
export const updateRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'].includes(status)) {
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

    // runValidators is intentionally omitted: past requiredBy date would fail
    // validation on legitimate status updates (e.g. marking an old request completed)
    const updatedRequest = await Request.findByIdAndUpdate(
      requestId,
      { status },
      { returnDocument: 'after' }
    );

    response.success(res, 200, 'Request status updated successfully', updatedRequest);
  } catch (error) {
    next(error);
  }
};

// Close a request (set status to 'completed')
export const closeRequest = async (req, res, next) => {
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

    if (request.status === 'completed' || request.status === 'expired') {
      return response.error(res, 400, 'Request is already completed');
    }

    const updatedRequest = await Request.findByIdAndUpdate(requestId, { status: 'completed', completedAt: new Date() }, { returnDocument: 'after' });

    return response.success(res, 200, 'Request closed successfully', updatedRequest);
  } catch (error) {
    next(error);
  }
};

// Cancel request and all associated pending donations
export const deleteRequest = async (req, res, next) => {
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

    // Cancel all pending/scheduled donations for this request
    await Donation.updateMany(
      { requestId, status: { $ne: 'completed' } },
      { status: 'cancelled' }
    );

    await Request.findByIdAndUpdate(requestId, { status: 'cancelled', cancelledAt: new Date() });

    response.success(res, 200, 'Request cancelled successfully');
  } catch (error) {
    next(error);
  }
};

// Get donations for hospital's requests — supports ?page=1&limit=10 or legacy ?skip=0&limit=10
export const getDonations = async (req, res, next) => {
  try {
    const { status } = req.query;
    const { skip, limit, page } = parsePagination(req.query);

    // Get all request IDs belonging to this hospital
    const hospitalRequests = await Request.find({ hospitalId: req.user.userId }).select('_id');
    const requestIds = hospitalRequests.map((r) => r._id);

    const filter = { requestId: { $in: requestIds } };

    if (status && ['pending', 'scheduled', 'completed', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .populate('donorId', 'fullName email phoneNumber location bloodType')
        .populate('requestId', 'type bloodType organType urgency')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Donation.countDocuments(filter),
    ]);

    response.success(res, 200, 'Donations retrieved successfully', {
      donations,
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getBloodBankSettings = async (req, res, next) => {
  try {
    const settings = await HospitalSettings.findOne({ hospitalId: req.user.userId });
    return response.success(res, 200, 'Blood bank settings retrieved successfully', {
      bloodBankSettings: settings?.bloodBankSettings || {
        criticalThreshold: {},
        lowThreshold: {},
        automaticNotifications: true,
        notificationEmail: null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBloodBankSettings = async (req, res, next) => {
  try {
    const { criticalThreshold, lowThreshold, automaticNotifications, notificationEmail } = req.body;

    const settings = await HospitalSettings.findOneAndUpdate(
      { hospitalId: req.user.userId },
      {
        $set: {
          'bloodBankSettings.criticalThreshold': criticalThreshold || {},
          'bloodBankSettings.lowThreshold': lowThreshold || {},
          'bloodBankSettings.automaticNotifications': automaticNotifications !== undefined ? Boolean(automaticNotifications) : true,
          'bloodBankSettings.notificationEmail': notificationEmail || null,
        },
        $setOnInsert: { hospitalId: req.user.userId },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return response.success(res, 200, 'Blood bank settings updated successfully', {
      bloodBankSettings: settings.bloodBankSettings,
    });
  } catch (error) {
    next(error);
  }
};

export const getNotificationPreferences = async (req, res, next) => {
  try {
    const settings = await HospitalSettings.findOne({ hospitalId: req.user.userId });
    return response.success(res, 200, 'Notification preferences retrieved successfully', {
      notificationPreferences: settings?.notificationPreferences || { email: true, push: true, sms: false },
    });
  } catch (error) {
    next(error);
  }
};

export const updateNotificationPreferences = async (req, res, next) => {
  try {
    const { email, push, sms } = req.body;
    const settings = await HospitalSettings.findOneAndUpdate(
      { hospitalId: req.user.userId },
      {
        $set: {
          'notificationPreferences.email': email !== undefined ? Boolean(email) : true,
          'notificationPreferences.push': push !== undefined ? Boolean(push) : true,
          'notificationPreferences.sms': sms !== undefined ? Boolean(sms) : false,
        },
        $setOnInsert: { hospitalId: req.user.userId },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return response.success(res, 200, 'Notification preferences updated successfully', {
      notificationPreferences: settings.notificationPreferences,
    });
  } catch (error) {
    next(error);
  }
};

export const getBloodInventory = async (req, res, next) => {
  try {
    const summary = await adminService.getBloodInventorySummary(req.user.userId);
    return response.success(res, 200, 'Blood inventory retrieved successfully', summary);
  } catch (error) {
    next(error);
  }
};

export const getMonthlyReports = async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const startDate = new Date(`${month}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    const hospitalObjectId = new mongoose.Types.ObjectId(req.user.userId);

    const requestMatch = {
      hospitalId: hospitalObjectId,
      createdAt: { $gte: startDate, $lt: endDate },
    };

    const [requests, donations] = await Promise.all([
      Request.find(requestMatch).select('type status urgency quantity createdAt'),
      Donation.aggregate([
        { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
        { $unwind: '$request' },
        { $match: { 'request.hospitalId': hospitalObjectId, createdAt: requestMatch.createdAt } },
      ]),
    ]);

    const totalRequests = requests.length;
    const totalCompleted = requests.filter((r) => r.status === 'completed').length;
    const totalCancelled = requests.filter((r) => r.status === 'cancelled').length;
    const emergencyRequests = requests.filter((r) => r.urgency === 'critical' || r.urgency === 'high').length;

    return response.success(res, 200, 'Monthly report retrieved successfully', {
      month,
      totalRequests,
      totalCompleted,
      totalCancelled,
      emergencyRequests,
      totalDonations: donations.length,
    });
  } catch (error) {
    next(error);
  }
};



export const createHospital = async (req, res, next) => {
  try {
    const validation = validateCreateHospitalByAdminBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors.join(', '));
    }

    const result = await hospitalService.createHospitalByAdmin(req.body, req.user._id);
    return response.success(res, 201, 'Hospital created successfully', result);
  } catch (error) {
    if (error.message === 'Email already registered') {
      return response.error(res, 409, error.message);
    }
    if (error.message === 'License number already registered') {
      return response.error(res, 409, error.message);
    }
    next(error);
  }
};


// GET /hospital/appointment-settings
export const getAppointmentSettings = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.user.userId).select(
      'slotsPerHour workingHoursStart workingHoursEnd'
    );
    if (!hospital) return response.error(res, 404, 'Hospital not found');

    return response.success(res, 200, 'Appointment settings retrieved', {
      slotsPerHour: hospital.slotsPerHour ?? 5,
      workingHoursStart: hospital.workingHoursStart ?? 9,
      workingHoursEnd: hospital.workingHoursEnd ?? 17,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /hospital/appointment-settings
export const updateAppointmentSettings = async (req, res, next) => {
  try {
    const { slotsPerHour, workingHoursStart, workingHoursEnd } = req.body;

    const errors = [];
    if (slotsPerHour !== undefined) {
      const v = Number(slotsPerHour);
      if (!Number.isInteger(v) || v < 1 || v > 100) {
        errors.push('slotsPerHour must be an integer between 1 and 100');
      }
    }
    if (workingHoursStart !== undefined) {
      const v = Number(workingHoursStart);
      if (!Number.isInteger(v) || v < 0 || v > 23) {
        errors.push('workingHoursStart must be an integer between 0 and 23');
      }
    }
    if (workingHoursEnd !== undefined) {
      const v = Number(workingHoursEnd);
      if (!Number.isInteger(v) || v < 0 || v > 24) {
        errors.push('workingHoursEnd must be an integer between 0 and 24');
      }
    }
    if (
      workingHoursStart !== undefined &&
      workingHoursEnd !== undefined &&
      Number(workingHoursEnd) <= Number(workingHoursStart)
    ) {
      errors.push('workingHoursEnd must be greater than workingHoursStart');
    }
    if (errors.length) return response.error(res, 400, errors.join(', '));

    const updateData = {};
    if (slotsPerHour !== undefined) updateData.slotsPerHour = Number(slotsPerHour);
    if (workingHoursStart !== undefined) updateData.workingHoursStart = Number(workingHoursStart);
    if (workingHoursEnd !== undefined) updateData.workingHoursEnd = Number(workingHoursEnd);

    const hospital = await Hospital.findByIdAndUpdate(
      req.user.userId,
      { $set: updateData },
      { new: true, runValidators: true, select: 'slotsPerHour workingHoursStart workingHoursEnd' }
    );
    if (!hospital) return response.error(res, 404, 'Hospital not found');

    return response.success(res, 200, 'Appointment settings updated', {
      slotsPerHour: hospital.slotsPerHour,
      workingHoursStart: hospital.workingHoursStart,
      workingHoursEnd: hospital.workingHoursEnd,
    });
  } catch (error) {
    next(error);
  }
};
