import response from '../utils/response.js';
import { PATIENT_TYPE_ENUM, PATIENT_DETAILS_ENUM } from '../constants/request.constants.js';
import mongoose from 'mongoose';
import Hospital from '../models/Hospital.model.js';
import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import NotificationOutbox from '../models/NotificationOutbox.model.js';
import * as notificationService from '../services/notification.service.js';
import * as matchingService from '../services/matching.service.js';
import * as appointmentService from '../services/appointment.service.js';
import Appointment from '../models/Appointment.model.js';
import { appointmentPopulateOptions, toAppointmentResponse } from '../utils/appointment.dto.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import HospitalSettings from '../models/HospitalSettings.model.js';
import * as adminService from '../services/admin.service.js';
import * as hospitalService from '../services/hospital.service.js';
import * as authService from '../services/auth.service.js';
import { ERR } from '../utils/errorCodes.js';
import { validateCreateHospitalByAdminBody } from '../validation/admin.validation.js';
import { DONATION_TYPE_LABELS } from '../constants/donation.constants.js';
import {
  validateFindDonorsQuery,
  validateBookAppointmentBody,
  validateCreateRequestBody,
  validateCreateEmergencyRequestBody,
  buildRequiredByDate,
} from '../validation/hospital.validation.js';
import { normalizeBloodTypeList, extractFirstBloodType } from '../utils/blood-type.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { validateTransition } from '../utils/state-machine.js';
import { parseLatLng, extractLocation } from '../utils/geo.js';
import { formatDistance } from '../utils/format.js';
import { toNumber, toLocation, parseBooleanQuery } from '../utils/query.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const EMERGENCY_REQUEST_REQUIRED_BY_MS = 24 * 60 * 60 * 1000;

const buildAppointmentDate = ({ appointmentDate, date, time }) => {
  if (appointmentDate) return new Date(appointmentDate);
  if (!date) return null;

  const scheduledDate = new Date(date);
  if (Number.isNaN(scheduledDate.getTime())) return null;

  if (time) {
    const timeStr = String(time).trim();
    let match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        scheduledDate.setHours(hour, minute, 0, 0);
        return scheduledDate;
      }
    }

    match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const period = match[3].toUpperCase();
      if (hour >= 1 && hour <= 12 && minute >= 0 && minute < 60) {
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        scheduledDate.setHours(hour, minute, 0, 0);
        return scheduledDate;
      }
    }
    return null;
  }

  return scheduledDate;
};
    
const resolveHospitalCoordinates = (hospital) => extractLocation(hospital, 'hospital');

const getHospitalDisplayName = (doc) => doc.hospitalName || doc.fullName || doc.name || null;

const buildEmergencyRequestData = (userId, hospital, validation) => ({
  hospitalId: userId,
  hospitalContact: hospital.contactNumber || hospital.phone,
  contactNumber: hospital.contactNumber || hospital.phone,
  type: 'blood',
  urgency: 'critical',
  requiredBy: new Date(Date.now() + EMERGENCY_REQUEST_REQUIRED_BY_MS),
  unitsNeeded: validation.unitsNeeded,
  patientType: 'adult',
  isEmergency: true,
  patientDetails: validation.patientDetails,
  notes: '',
  bloodType: validation.bloodTypes,
});

const buildNormalRequestData = (userId, hospital, body, validation) => {
  const {
    type,
    bloodType,
    bloodTypes,
    urgency,
    requiredBy,
    date,
    time,
    quantity,
    unitsNeeded,
    patientType,
    patientDetails,
    contactNumber,
    isEmergency,
    notes,
  } = body;

  const bloodTypeInput = bloodTypes !== undefined ? bloodTypes : bloodType;
  const normalizedBloodTypes = validation.bloodTypes?.length > 0
    ? validation.bloodTypes
    : normalizeBloodTypeList(bloodTypeInput);

  const requiredByDate = buildRequiredByDate({ requiredBy, date, time });
  const resolvedUnits = Number(unitsNeeded ?? quantity ?? 1);
  const resolvedUrgency = isEmergency === true ? 'critical' : urgency;

  return {
    hospitalId: userId,
    hospitalContact: hospital.contactNumber || hospital.phone,
    contactNumber: contactNumber || hospital.contactNumber || hospital.phone,
    type,
    urgency: resolvedUrgency,
    requiredBy: requiredByDate,
    unitsNeeded: Number.isFinite(resolvedUnits) && resolvedUnits > 0 ? resolvedUnits : 1,
    patientType: patientType || null,
    patientDetails: patientDetails || null,
    isEmergency: isEmergency === true || resolvedUrgency === 'critical',
    notes: notes || '',
    ...(normalizedBloodTypes.length > 0 ? { bloodType: normalizedBloodTypes } : {}),
  };
};

const saveRequestWithOutbook = async (requestData) => {
  const session = await mongoose.startSession();
  let savedRequest = null;
  let outboxEntry = null;

  try {
    await session.withTransaction(async () => {
      const docs = await Request.create([requestData], { session });
      savedRequest = docs[0];

      if (requestData.isEmergency && mongoose.connection && mongoose.connection.readyState === 1) {
        const outboxDocs = await NotificationOutbox.create([
          { requestId: savedRequest._id, donorIds: [], status: 'pending' },
        ]);
        outboxEntry = outboxDocs[0];
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new HttpError(400, error.message);
    }
    throw error;
  } finally {
    session.endSession();
  }

  return { savedRequest, outboxEntry };
};

const sendEmergencyNotifications = async (savedRequest, outboxEntry) => {
  try {
    const compatibleDonors = await matchingService.findCompatibleDonors(savedRequest._id);
    const donorIds = compatibleDonors.map(({ donor }) => donor._id);

    if (outboxEntry) {
      try {
        await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { donorIds, status: 'ready' });
      } catch (_outbookUpdateErr) {
        // best-effort outbox update
      }
    }

    if (donorIds.length > 0) {
      try {
        await notificationService.notifyRequest(donorIds, savedRequest);
        if (outboxEntry) {
          await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { status: 'sent', attempts: 1, lastError: null });
        }
      } catch (notifyErr) {
        if (outboxEntry) {
          await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { status: 'failed', attempts: 1, lastError: String(notifyErr?.message || notifyErr) });
        }
      }
    } else if (outboxEntry) {
      await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { status: 'sent', attempts: 0 });
    }
  } catch (err) {
    try {
      if (outboxEntry) {
        await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { status: 'failed', lastError: String(err?.message || err) });
      }
    } catch (_ignored) {
      // outbook already failed — nothing more to do
    }
  }
};

const attachLocationToRequestData = (requestData, hospital) => {
  const lat = hospital?.location?.coordinates?.lat;
  const lng = hospital?.location?.coordinates?.lng;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    requestData.hospitalLocationGeo = { type: 'Point', coordinates: [lng, lat] };
  }
  requestData.hospitalName = getHospitalDisplayName(hospital);
};

const buildHospitalProfileStats = async (hospitalId) => {
  const hospitalObjectId = new mongoose.Types.ObjectId(hospitalId);
  const [requestStats, donorStats, donationStats] = await Promise.all([
    Request.aggregate([
      { $match: { hospitalId: hospitalObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Donation.aggregate([
      { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
      { $unwind: '$request' },
      { $match: { 'request.hospitalId': hospitalObjectId } },
      { $group: { _id: '$donorId' } },
      { $count: 'count' },
    ]),
    Donation.aggregate([
      { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
      { $unwind: '$request' },
      { $match: { 'request.hospitalId': hospitalObjectId, status: 'completed' } },
      { $count: 'count' },
    ]),
  ]);

  const statusCounts = requestStats.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const totalRequests = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  const pendingRequests = (statusCounts.pending || 0) + (statusCounts.accepted || 0) + (statusCounts['in-progress'] || 0);
  const completedRequests = statusCounts.completed || 0;
  const cancelledRequests = statusCounts.cancelled || 0;
  const expiredRequests = statusCounts.expired || 0;
  const totalDonors = donorStats[0]?.count || 0;
  const completedDonations = donationStats[0]?.count || 0;

  return {
    totalRequests,
    pendingRequests,
    completedRequests,
    cancelledRequests,
    expiredRequests,
    totalDonors,
    completedDonations,
  };
};

const toHospitalProfilePayload = (hospitalDoc, stats) => {
  const hospital = hospitalDoc?.toObject ? hospitalDoc.toObject() : { ...hospitalDoc };
  delete hospital.password;

  const lat = Number(hospital.lat ?? hospital.location?.coordinates?.lat);
  const lng = Number(hospital.long ?? hospital.location?.coordinates?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const city = hospital.city || hospital.address?.city || hospital.location?.city || null;
  const governorate = hospital.state || hospital.address?.governorate || hospital.location?.governorate || null;

  const location = {
    ...(city ? { city } : {}),
    ...(governorate ? { governorate } : {}),
    ...(hasCoords
      ? { coordinates: { lat, lng } }
      : {}),
  };

  return {
    ...hospital,
    location,
    stats: stats || {
      totalRequests: 0,
      pendingRequests: 0,
      completedRequests: 0,
      cancelledRequests: 0,
      expiredRequests: 0,
      totalDonors: 0,
      completedDonations: 0,
    },
  };
};

export const getProfile = asyncHandler(async (req, res) => {
  const hospital = await Hospital.findById(req.user.userId).select('-password');
  if (!hospital) {
    throw new HttpError(404, 'Hospital profile not found');
  }

  const [stats, settings] = await Promise.all([
    buildHospitalProfileStats(req.user.userId),
    HospitalSettings.findOne({ hospitalId: req.user.userId }),
  ]);

  const totalRequests = stats.totalRequests;
  const fulfilled = stats.completedRequests;
  const active = (stats.pendingRequests ?? 0) + (stats.cancelledRequests ?? 0) > 0
    ? stats.totalRequests - fulfilled - (stats.cancelledRequests ?? 0) - (stats.expiredRequests ?? 0)
    : 0;
  const successRate = totalRequests > 0 ? Math.round((fulfilled / totalRequests) * 100) : 0;

  const prefs = settings?.notificationPreferences || {};

  response.success(res, 200, 'Hospital profile retrieved successfully', {
    hospitalName: getHospitalDisplayName(hospital),
    department: hospital.department || null,
    contactNumber: hospital.contactNumber || hospital.phone || null,
    email: hospital.email,
    address: typeof hospital.address === 'string' ? hospital.address : hospital.address ? JSON.stringify(hospital.address) : null,
    workingHours: {
      openingHour: hospital.workingHoursStart ?? 9,
      closingHour: hospital.workingHoursEnd ?? 17,
      slotsPerHour: hospital.slotsPerHour ?? 5,
    },
    notifications: {
      pushNotifications: prefs.pushNotifications ?? true,
      emergencyAlerts: prefs.emergencyAlerts ?? true,
      emailNotifications: prefs.emailNotifications ?? true,
      smsAlerts: prefs.smsAlerts ?? false,
    },
    statistics: {
      totalRequests,
      fulfilled,
      active,
      successRate,
    },
  });
});

export const toHospitalRequestResponse = (requestDoc, metrics = {}) => {
  const request = requestDoc?.toObject ? requestDoc.toObject() : { ...requestDoc };
  const unitsNeeded = Number(request.unitsNeeded ?? 1);
  const status = request.status || null;
  const isFulfilled = status === 'completed';

  const hospital = request.hospitalId && typeof request.hospitalId === 'object' && request.hospitalId._id
    ? request.hospitalId
    : null;

  return {
    ...request,
    id: request._id?.toString?.() || request.id,
    requestId: request._id?.toString?.() || request.requestId,
    bloodType: extractFirstBloodType(request.bloodType),
    unitsNeeded,
    unitsRequested: unitsNeeded,
    isFulfilled,
    status,
    requestStatus: status,
    createdAt: request.createdAt,
    requestDate: request.createdAt,
    donorsResponded: Number(metrics.donorsResponded || 0),
    donorsConfirmed: Number(metrics.donorsConfirmed || 0),
    hospital: hospital
      ? {
          id: hospital._id?.toString?.() || null,
          name: getHospitalDisplayName(hospital),
          hospitalName: getHospitalDisplayName(hospital),
        }
      : request.hospitalId
        ? { id: request.hospitalId.toString(), name: request.hospitalName || null, hospitalName: request.hospitalName || null }
        : null,
  };
};

export const findDonors = asyncHandler(async (req, res) => {
  const bloodType = typeof req.query.bloodType === 'string' && req.query.bloodType.trim()
    ? req.query.bloodType.replace(/\s+/g, '+').trim().toUpperCase()
    : null;
  const radiusKm = toNumber(req.query.radiusKm) ?? 5;
  const { lat, lng, hasCoordinates } = parseLatLng(req.query);
  const participation = req.query.participation !== undefined
    ? parseBooleanQuery(req.query.participation, true)
    : parseBooleanQuery(req.query.availability, true);
  const { page, limit, offset } = parsePagination(req.query, 20);

  const validation = validateFindDonorsQuery(req.query, hasCoordinates ? lat : null, hasCoordinates ? lng : null, radiusKm, participation);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  let searchCoordinates = lat !== null && lng !== null ? { latitude: lat, longitude: lng } : null;

  if (!searchCoordinates) {
    if (req.user.role !== 'hospital') {
      throw new HttpError(400, 'lat and lng are required for admin and superadmin users');
    }

    const hospital = await Hospital.findById(req.user.userId).select('location lat long');
    if (!hospital) {
      throw new HttpError(404, 'Hospital profile not found');
    }

    searchCoordinates = resolveHospitalCoordinates(hospital);
    if (!searchCoordinates) {
      throw new HttpError(400, 'Hospital coordinates are required to search for donors');
    }
  }

  const searchLocation = {
    coordinates: {
      lat: searchCoordinates.latitude,
      lng: searchCoordinates.longitude,
    },
  };

  const matches = await matchingService.searchCompatibleDonors({
    bloodType,
    participation,
    radiusKm,
    location: searchLocation,
  });

  const donors = matches.map(({ donor, distanceKm }) => {
    const coordinates = toLocation(donor.location?.coordinates);
    return {
      id: donor._id.toString(),
      donorId: donor._id.toString(),
      name: donor.fullName,
      fullName: donor.fullName,
      bloodType: donor.bloodType,
      email: donor.email || null,
      phoneNumber: donor.phoneNumber || null,
      distance: formatDistance(distanceKm),
      distanceInKm: distanceKm,
      distanceKm,
      distanceMeters: distanceKm === null ? null : Math.round(distanceKm * 1000),
      isOptedIn: Boolean(donor.isOptedIn ?? true),
      latitude: coordinates?.lat ?? null,
      longitude: coordinates?.lng ?? null,
      location: coordinates,
    };
  });

  const paginatedDonors = donors.slice(offset, offset + limit);
  const pagination = paginationMeta(donors.length, page, limit);

  if (req.query.groupBy === 'bloodType') {
    const grouped = donors.reduce((groupsByBloodType, donor) => {
      const existing = groupsByBloodType.get(donor.bloodType) || {
        bloodType: donor.bloodType,
        count: 0,
        nearestDistanceKm: null,
      };

      existing.count += 1;
      if (donor.distanceKm !== null && (existing.nearestDistanceKm === null || donor.distanceKm < existing.nearestDistanceKm)) {
        existing.nearestDistanceKm = donor.distanceKm;
      }
      groupsByBloodType.set(donor.bloodType, existing);
      return groupsByBloodType;
    }, new Map());

    return response.success(res, 200, 'Nearby donor groups retrieved successfully', {
      groups: [...grouped.values()].sort((left, right) => left.bloodType.localeCompare(right.bloodType)),
    });
  }

  return response.success(res, 200, 'Nearby donors retrieved successfully', {
    donors: paginatedDonors,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  });
});

export const bookDonorAppointment = asyncHandler(async (req, res) => {
  const donorId = req.params.donorId;
  const { appointmentDate, date, time, notes, donationType, requestId } = req.body;

  if (!donorId) {
    throw new HttpError(400, 'donorId is required');
  }

  const normalizedAppointmentDate = buildAppointmentDate({ appointmentDate, date, time });
  const validation = validateBookAppointmentBody(req.body, normalizedAppointmentDate);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  const normalizedDonationType = donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD;

  try {
    const appointment = await appointmentService.bookAppointment(
      donorId,
      req.user.userId,
      requestId || null,
      normalizedAppointmentDate,
      notes || '',
      normalizedDonationType
    );

    // Populate donor/hospital/request details for DTO conversion
    await appointment.populate(appointmentPopulateOptions);
    await appointment.populate({ path: 'requestId', select: 'type bloodType organType urgency hospitalId' });

    const appointmentResponse = toAppointmentResponse(appointment);

    return response.success(res, 201, 'Appointment booked successfully', appointmentResponse);
  } catch (error) {
    if (error.message === ELIGIBILITY_KEYS.DONOR_NOT_FOUND || error.message === 'Hospital not found' || error.message === ELIGIBILITY_KEYS.REQUEST_NOT_FOUND) {
      throw new HttpError(404, error.message);
    }
    if (
      error.message === 'Invalid donor or hospital id' ||
      error.message === 'Invalid appointment id' ||
      error.message === 'Invalid request id' ||
      error.message === 'Appointment date must be in the future' ||
      error.message === 'Request does not belong to this hospital' ||
      error.message === ELIGIBILITY_KEYS.DONOR_CURRENTLY_UNAVAILABLE ||
      error.message === ELIGIBILITY_KEYS.DONOR_SUSPENDED ||
      error.message === ELIGIBILITY_KEYS.DONOR_HAS_NO_BLOOD_TYPE ||
      error.message === ELIGIBILITY_KEYS.BLOOD_TYPE_INCOMPATIBLE ||
      error.message === ELIGIBILITY_KEYS.DONATION_COOLDOWN_ACTIVE
    ) {
      throw new HttpError(400, error.message);
    }
    if (error.message === 'You already have an active appointment at this hospital') {
      throw new HttpError(409, error.message);
    }
    throw error;
  }
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { hospitalName, department, phone, contactNumber, email, address } = req.body;

  const hospital = await Hospital.findById(req.user.userId);
  if (!hospital) {
    throw new HttpError(404, 'Hospital profile not found');
  }

  if (hospitalName !== undefined) {
    hospital.hospitalName = hospitalName;
    hospital.fullName = hospitalName;
    hospital.name = hospitalName;
  }
  if (department !== undefined) hospital.department = department;
  if (contactNumber !== undefined) {
    hospital.contactNumber = contactNumber;
  }
  if (phone !== undefined) {
    hospital.phone = phone;
    hospital.contactNumber = contactNumber !== undefined ? contactNumber : phone;
  }
  if (email !== undefined) hospital.email = email;
  if (address !== undefined) hospital.address = address;

  try {
    await hospital.save();
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new HttpError(400, error.message);
    }
    throw error;
  }

  response.success(res, 200, 'Profile updated successfully');
});

export const updateWorkingHours = asyncHandler(async (req, res) => {
  const { openingHour, closingHour, slotsPerHour } = req.body;

  const hospital = await Hospital.findById(req.user.userId);
  if (!hospital) {
    throw new HttpError(404, 'Hospital profile not found');
  }

  if (openingHour !== undefined) {
    if (!Number.isInteger(openingHour) || openingHour < 0 || openingHour > 23) {
      throw new HttpError(400, 'openingHour must be an integer between 0 and 23');
    }
    hospital.workingHoursStart = openingHour;
  }
  if (closingHour !== undefined) {
    if (!Number.isInteger(closingHour) || closingHour < 0 || closingHour > 23) {
      throw new HttpError(400, 'closingHour must be an integer between 0 and 23');
    }
    hospital.workingHoursEnd = closingHour;
  }
  if (slotsPerHour !== undefined) {
    if (!Number.isInteger(slotsPerHour) || slotsPerHour < 1) {
      throw new HttpError(400, 'slotsPerHour must be a positive integer');
    }
    hospital.slotsPerHour = slotsPerHour;
  }

  await hospital.save();

  response.success(res, 200, 'Working hours updated successfully');
});

export const updateProfileLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    throw new HttpError(400, 'lat and lng are required');
  }

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
    throw new HttpError(400, 'lat must be a valid number between -90 and 90');
  }
  if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
    throw new HttpError(400, 'lng must be a valid number between -180 and 180');
  }

  const hospital = await Hospital.findById(req.user.userId);
  if (!hospital) {
    throw new HttpError(404, 'Hospital profile not found');
  }

  hospital.lat = parsedLat;
  hospital.long = parsedLng;
  hospital.location = {
    ...(hospital.location?.toObject ? hospital.location.toObject() : hospital.location || {}),
    coordinates: { lat: parsedLat, lng: parsedLng },
    lastUpdated: new Date(),
  };

  await hospital.save();

  response.success(res, 200, 'Hospital location updated successfully');
});

const buildDonationMetricsByRequest = async (requestIds) => {
  if (requestIds.length === 0) return new Map();

  const rows = await Donation.aggregate([
    { $match: { requestId: { $in: requestIds } } },
    {
      $group: {
        _id: '$requestId',
        donorsResponded: { $sum: 1 },
        donorsConfirmed: {
          $sum: {
            $cond: [{ $in: ['$status', ['scheduled', 'completed']] }, 1, 0],
          },
        },
      },
    },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row]));
};

const createRequestFromHospital = async (req, res, { emergencyOnly = false } = {}) => {
  const validation = emergencyOnly
    ? validateCreateEmergencyRequestBody(req.body)
    : validateCreateRequestBody(req.body);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  const hospital = await Hospital.findById(req.user.userId).select('phone contactNumber location fullName hospitalName');
  if (!hospital) {
    throw new HttpError(404, 'Hospital profile not found');
  }
  if (!hospital.phone && !hospital.contactNumber) {
    throw new HttpError(400, 'Hospital contact number is required before creating a request');
  }

  const requestData = emergencyOnly
    ? buildEmergencyRequestData(req.user.userId, hospital, validation)
    : buildNormalRequestData(req.user.userId, hospital, req.body, validation);

  attachLocationToRequestData(requestData, hospital);

  const { savedRequest, outboxEntry } = await saveRequestWithOutbook(requestData);

  await savedRequest.populate('hospitalId', 'fullName hospitalName address phone contactNumber');
  response.success(res, 201, 'Donation request created successfully', toHospitalRequestResponse(savedRequest));

  if (requestData.isEmergency) {
    await sendEmergencyNotifications(savedRequest, outboxEntry);
  }
};

export const createRequest = asyncHandler((req, res) => createRequestFromHospital(req, res, { emergencyOnly: false }));

export const createEmergencyRequest = asyncHandler((req, res) => createRequestFromHospital(req, res, { emergencyOnly: true }));

// Get hospital's requests — supports ?page=1&limit=10&status=pending,accepted,in-progress
export const getRequests = asyncHandler(async (req, res) => {
  const { status, type } = req.query;
  const { offset, limit, page } = parsePagination(req.query);

  const filter = { hospitalId: req.user.userId };

  const allowedStatuses = ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'];
  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter((s) => allowedStatuses.includes(s));
    if (statuses.length > 0) {
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
  }
  if (type && ['blood', 'plasma', 'platelets', 'double_red_cells'].includes(type)) {
    filter.type = type;
  }

  const [requests, total] = await Promise.all([
    Request.find(filter).skip(offset).limit(limit).sort({ createdAt: -1 }),
    Request.countDocuments(filter),
  ]);
  const requestMetrics = await buildDonationMetricsByRequest(requests.map((item) => item._id));

  const totalPages = Math.ceil(total / limit) || 1;

  response.success(res, 200, 'Requests retrieved successfully', {
    requests: requests.map((item) => {
      const r = toHospitalRequestResponse(item, requestMetrics.get(item._id.toString()));
      delete r.hospital;
      return r;
    }),
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  });
});

const formatRequestDetailResponse = (request, donations) => {
  const responded = donations.length;
  const confirmed = donations.filter(d => ['scheduled', 'completed'].includes(d.status)).length;
  const diffMs = new Date(request.requiredBy).getTime() - Date.now();
  let timeRemaining = 'Expired';
  if (diffMs > 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) {
      const remainingHours = diffHours % 24;
      timeRemaining = `${diffDays}d ${remainingHours}h remaining`;
    } else if (diffHours > 0) {
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      timeRemaining = `${diffHours}h ${diffMins}m remaining`;
    } else {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      timeRemaining = `${diffMins}m remaining`;
    }
  }

  return {
    requiredBy: request.requiredBy,
    bloodTypes: request.bloodType,
    unitsNeeded: request.unitsNeeded,
    urgency: request.urgency,
    timeRemaining,
    responded,
    confirmed,
    status: request.status,
    patientType: request.patientType,
    patientDetails: request.patientDetails || null,
    contactNumber: request.contactNumber || null,
  };
};

export const getRequestDetails = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const request = await Request.findById(requestId).populate(
    'hospitalId',
    'fullName hospitalName address phone'
  );

  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  if (request.hospitalId._id.toString() !== req.user.userId.toString()) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  // Get donations for this request
  const donations = await Donation.find({ requestId }).populate(
    'donorId',
    'fullName email phoneNumber location bloodType lastDonationDate'
  );

  const responseData = formatRequestDetailResponse(request, donations);
  response.success(res, 200, 'Request details retrieved successfully', responseData);
});

export const getRequestResponses = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const request = await Request.findById(requestId).select('hospitalId');
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }
  if (request.hospitalId.toString() !== req.user.userId.toString()) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  const donations = await Donation.find({ requestId })
    .populate('donorId', 'fullName phoneNumber bloodType isOptedIn')
    .sort({ createdAt: -1 });

  const donors = donations
    .filter((donation) => donation.donorId)
    .map((donation) => ({
      donorId: donation.donorId._id.toString(),
      fullName: donation.donorId.fullName,
      bloodType: donation.donorId.bloodType,
      isAvailable: Boolean(donation.donorId.isOptedIn ?? true),
      phoneNumber: donation.donorId.phoneNumber || null,
      responseStatus: donation.status,
      respondedAt: donation.createdAt,
    }));

  return response.success(res, 200, 'Request responses retrieved successfully', { donors });
});

export const confirmDonation = asyncHandler(async (req, res) => {
  const { donorId, requestId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(donorId) || !mongoose.Types.ObjectId.isValid(requestId)) {
    throw new HttpError(400, 'donorId and requestId must be valid ids');
  }

  const request = await Request.findById(requestId);
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }
  if (request.hospitalId.toString() !== req.user.userId.toString()) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  const donation = await Donation.findOne({
    donorId,
    requestId,
    status: { $in: ['pending', 'scheduled'] },
  });
  if (!donation) {
    throw new HttpError(404, 'Active donor response not found');
  }

  if (!['accepted', 'in-progress'].includes(request.status)) {
    throw new HttpError(400, 'Request must be accepted or in-progress before confirming donation');
  }

  const donor = await Donor.findById(donorId);
  if (!donor) {
    throw new HttpError(404, 'Donor not found');
  }

  const session = await mongoose.startSession();
  const completedAt = new Date();
  try {
    await session.withTransaction(async () => {
      validateTransition('donation', donation.status, 'completed');
      validateTransition('request', request.status, 'completed');

      donation.status = 'completed';
      donation.completedDate = completedAt;
      donation.qrUsed = true;
      donation.qrUsedAt = completedAt;
      await donation.save({ session });

      request.status = 'completed';
      request.completedAt = completedAt;
      request.acceptedBy = donor._id;
      request.acceptedByName = donor.fullName || null;
      request.acceptedByPhoneNumber = donor.phoneNumber || null;
      request.acceptedByBloodType = donor.bloodType || null;
      request.acceptedDonationId = donation._id;
      await request.save({ session });

      await Donor.findByIdAndUpdate(donor._id, { lastDonationDate: completedAt }, { session });
    });
  } finally {
    session.endSession();
  }

  return response.success(res, 200, 'Donation confirmed', {
    requestId: request._id.toString(),
    donorId: donor._id.toString(),
    donationId: donation._id.toString(),
    status: 'completed',
  });
});

export const updateRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const {
    status,
    bloodType,
    bloodTypes,
    urgency,
    requiredBy,
    quantity,
    unitsNeeded,
    patientType,
    contactNumber,
    notes,
    patientDetails,
  } = req.body;

  const request = await Request.findById(requestId);
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  if (request.hospitalId.toString() !== req.user.userId.toString()) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  if (status !== undefined) {
    if (!['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'].includes(status)) {
      throw new HttpError(400, 'Valid status is required');
    }

    if (request.status !== status) {
      // Guard: validate transition through the centralized state machine.
      try {
        validateTransition('request', request.status, status);
      } catch (err) {
        throw new HttpError(400, err.message);
      }

      if (status === 'completed') {
        const completedDonation = await Donation.findOne({
          requestId: request._id,
          status: 'completed',
        });
        if (!completedDonation) {
          throw new HttpError(400, 'Cannot complete request: no completed donation found for this request. Use cancel instead.');
        }
      }

      if (status === 'accepted' && !request.acceptedDonationId) {
        throw new HttpError(400, 'Cannot mark request accepted without an accepted donation');
      }

      request.status = status;
    }
  }

  const isUpdatingDetails =
    bloodType !== undefined ||
    bloodTypes !== undefined ||
    urgency !== undefined ||
    requiredBy !== undefined ||
    quantity !== undefined ||
    unitsNeeded !== undefined ||
    patientType !== undefined ||
    patientDetails !== undefined ||
    contactNumber !== undefined ||
    notes !== undefined;

  if (isUpdatingDetails) {
    if (['completed', 'cancelled', 'expired'].includes(request.status)) {
      throw new HttpError(400, `Cannot update details of a request with terminal status "${request.status}"`);
    }

    if (bloodType !== undefined || bloodTypes !== undefined) {
      const bloodTypeInput = bloodTypes !== undefined ? bloodTypes : bloodType;
      const normalizedBloodTypes = normalizeBloodTypeList(bloodTypeInput);
      if (normalizedBloodTypes.length === 0 && ['blood', 'double_red_cells'].includes(request.type)) {
        throw new HttpError(400, 'Blood type is required for blood or double red cells requests');
      }
      request.bloodType = normalizedBloodTypes;
    }

    if (urgency !== undefined) {
      if (!['low', 'medium', 'high', 'critical'].includes(urgency)) {
        throw new HttpError(400, 'Urgency must be low, medium, high, or critical');
      }
      request.urgency = urgency;
    }

    if (requiredBy !== undefined) {
      const requiredByDate = new Date(requiredBy);
      if (Number.isNaN(requiredByDate.getTime())) {
        throw new HttpError(400, 'Required date must be a valid date');
      }
      if (requiredByDate <= new Date()) {
        throw new HttpError(400, 'Required date must be in the future');
      }
      request.requiredBy = requiredByDate;
    }

    if (unitsNeeded !== undefined || quantity !== undefined) {
      const val = Number(unitsNeeded ?? quantity);
      if (!Number.isInteger(val) || val < 1) {
        throw new HttpError(400, 'Units needed must be at least 1');
      }
      request.unitsNeeded = val;
    }

    if (patientType !== undefined) {
      if (!PATIENT_TYPE_ENUM.includes(patientType)) {
        throw new HttpError(400, `patientType must be one of: ${PATIENT_TYPE_ENUM.join(', ')}`);
      }
      request.patientType = patientType;
    }

    if (patientDetails !== undefined) {
      if (!PATIENT_DETAILS_ENUM.includes(patientDetails)) {
        throw new HttpError(400, `patientDetails must be one of: ${PATIENT_DETAILS_ENUM.join(', ')}`);
      }
      request.patientDetails = patientDetails;
    }

    if (contactNumber !== undefined) {
      if (contactNumber && !/^\+?[0-9]{10,15}$/.test(contactNumber)) {
        throw new HttpError(400, 'Contact number must be a valid phone number');
      }
      request.contactNumber = contactNumber;
    }

    if (notes !== undefined) {
      request.notes = notes;
    }
  }

  const session = await mongoose.startSession();
  const cancelledAt = new Date();
  try {
    await session.withTransaction(async () => {
      // Save changes if modified (this runs validations and pre-save hooks on the document)
      await request.save({ session });

      if (status !== undefined && ['completed', 'cancelled', 'expired'].includes(status)) {
        await appointmentService.cancelActiveAppointmentsForRequest(requestId, {
          cancelledAt,
          notes: `Appointment cancelled because request was marked as ${status}`,
          session,
        });
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new HttpError(400, error.message);
    }
    throw error;
  } finally {
    session.endSession();
  }

  const donations = await Donation.find({ requestId: request._id });
  const responseData = formatRequestDetailResponse(request, donations);
  response.success(res, 200, 'Request updated successfully', responseData);
});

export const deleteRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const request = await Request.findById(requestId);
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  if (request.hospitalId.toString() !== req.user.userId.toString()) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  // Guard: only non-terminal requests can be cancelled.
  try {
    validateTransition('request', request.status, 'cancelled');
  } catch (err) {
    throw new HttpError(400, err.message);
  }

  // Cancel all pending/scheduled donations for this request and update request status atomically.
  const session = await mongoose.startSession();
  const cancelledAt = new Date();
  try {
    await session.withTransaction(async () => {
      const donationsToCancel = await Donation.find(
        { requestId, status: { $nin: ['completed', 'cancelled', 'rejected'] } },
        null,
        { session }
      );
      for (const donation of donationsToCancel) {
        validateTransition('donation', donation.status, 'cancelled');
        donation.status = 'cancelled';
        await donation.save({ session });
      }

      await Request.findByIdAndUpdate(
        requestId,
        {
          status: 'cancelled',
          cancelledAt,
          acceptedBy: null,
          acceptedByName: null,
          acceptedByPhoneNumber: null,
          acceptedByBloodType: null,
          acceptedAt: null,
          acceptedDonationId: null,
        },
        { session }
      );

      await appointmentService.cancelActiveAppointmentsForRequest(requestId, {
        cancelledAt,
        notes: 'Appointment cancelled because the linked request was cancelled',
        session,
      });
    });
  } finally {
    session.endSession();
  }

  request.status = 'cancelled';
  request.cancelledAt = cancelledAt;
  request.acceptedBy = null;
  request.acceptedByName = null;
  request.acceptedByPhoneNumber = null;
  request.acceptedByBloodType = null;
  request.acceptedAt = null;
  request.acceptedDonationId = null;

  response.success(res, 200, 'Request cancelled successfully', {
    request,
  });
});

// Get donations for hospital's requests — supports ?page=1&limit=10
export const getDonations = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { offset, limit, page } = parsePagination(req.query);

  const hospitalObjectId = new mongoose.Types.ObjectId(req.user.userId);
  const statusFilter = status && ['pending', 'scheduled', 'completed', 'cancelled'].includes(status)
    ? { status }
    : {};

  const basePipeline = [
    {
      $lookup: {
        from: 'requests',
        localField: 'requestId',
        foreignField: '_id',
        as: 'request',
      },
    },
    { $unwind: '$request' },
    {
      $match: {
        'request.hospitalId': hospitalObjectId,
        ...statusFilter,
      },
    },
    { $sort: { createdAt: -1 } },
  ];

  const [donations, totalResult] = await Promise.all([
    Donation.aggregate([
      ...basePipeline,
      { $skip: offset },
      { $limit: limit },
      { $project: { request: 0 } },
    ]),
    Donation.aggregate([
      ...basePipeline,
      { $count: 'count' },
    ]),
  ]);

  const total = totalResult[0]?.count || 0;
  const populatedDonations = await Donation.populate(donations, [
    { path: 'donorId', select: 'fullName email phoneNumber location bloodType' },
    { path: 'requestId', select: 'type bloodType organType urgency' },
  ]);

  response.success(res, 200, 'Donations retrieved successfully', {
    donations: populatedDonations,
    pagination: paginationMeta(total, page, limit),
  });
});

export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const { pushNotifications, emergencyAlerts, emailNotifications, smsAlerts } = req.body;

  const updateFields = {};

  if (pushNotifications !== undefined) {
    updateFields['notificationPreferences.pushNotifications'] = Boolean(pushNotifications);
  }

  if (emergencyAlerts !== undefined) {
    updateFields['notificationPreferences.emergencyAlerts'] = Boolean(emergencyAlerts);
  }

  if (emailNotifications !== undefined) {
    updateFields['notificationPreferences.emailNotifications'] = Boolean(emailNotifications);
  }

  if (smsAlerts !== undefined) {
    updateFields['notificationPreferences.smsAlerts'] = Boolean(smsAlerts);
  }

  await HospitalSettings.findOneAndUpdate(
    { hospitalId: req.user.userId },
    { $set: updateFields, $setOnInsert: { hospitalId: req.user.userId } },
    { upsert: true, returnDocument: 'after' }
  );

  return response.success(res, 200, 'Preferences saved');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new HttpError(400, 'currentPassword, newPassword, and confirmPassword are required');
  }
  if (newPassword !== confirmPassword) {
    throw new HttpError(400, 'newPassword and confirmPassword must match');
  }

  try {
    await authService.changePassword(req.user.userId, { currentPassword, newPassword });
  } catch (error) {
    if (error.message === ERR.AUTH_CURRENT_PASSWORD_INCORRECT) {
      throw new HttpError(400, error.message);
    }
    if (
      error.message.includes('required') ||
      error.message.includes('must be different')
    ) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }

  response.success(res, 200, 'Password updated successfully');
});

export const getAppointments = asyncHandler(async (req, res) => {
  const { offset, limit, page } = parsePagination(req.query, 20);

  const statusFilter = req.query.status && ['pending', 'confirmed', 'completed', 'cancelled'].includes(req.query.status)
    ? { status: req.query.status }
    : { status: { $in: ['pending', 'confirmed'] } };

  const now = new Date();
  const filter = {
    hospitalId: req.user.userId,
    appointmentDate: { $gte: now },
    ...statusFilter,
  };

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .populate(appointmentPopulateOptions)
      .populate({ path: 'requestId', select: 'type bloodType organType urgency hospitalId' })
      .sort({ appointmentDate: 1 })
      .skip(offset)
      .limit(limit),
    Appointment.countDocuments(filter),
  ]);

  const appointmentResponses = appointments.map(toAppointmentResponse);

  return response.success(res, 200, 'Appointments retrieved successfully', {
    appointments: appointmentResponses,
    pagination: paginationMeta(total, page, limit),
  });
});

// GET /hospital/appointments/:appointmentId - single appointment details for hospital
export const getAppointmentDetails = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  if (!appointmentId) throw new HttpError(400, 'appointmentId is required');
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) throw new HttpError(400, 'Invalid appointment id');

  const appointment = await Appointment.findOne({ _id: appointmentId, hospitalId: req.user.userId });
  if (!appointment) throw new HttpError(404, 'Appointment not found');

  await appointment.populate(appointmentPopulateOptions);
  await appointment.populate({ path: 'requestId', select: 'type bloodType organType urgency hospitalId' });

  const appointmentResponse = toAppointmentResponse(appointment);
  return response.success(res, 200, 'Appointment retrieved successfully', appointmentResponse);
});

const donationLookupStages = (hospitalObjectId, startDate, endDate, extraMatch = {}) => [
  { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
  { $unwind: '$request' },
  { $match: { 'request.hospitalId': hospitalObjectId, createdAt: { $gte: startDate, $lt: endDate }, ...extraMatch } },
];

export const getMonthlyReports = asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const startDate = new Date(`${month}-01T00:00:00.000Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  const hospitalObjectId = new mongoose.Types.ObjectId(req.user.userId);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [requests, donationsAgg, openCount, activeCount, completedCount, cancelledCount, overdueCount, dueSoonCount, avgDaysResult, completedDonationsAgg, confirmedDonorsAgg, responsesTodayAgg] = await Promise.all([
    Request.find({
      hospitalId: hospitalObjectId,
      createdAt: { $gte: startDate, $lt: endDate },
    }).select('status urgency requiredBy'),
    Donation.aggregate(donationLookupStages(hospitalObjectId, startDate, endDate)),
    Request.countDocuments({
      hospitalId: hospitalObjectId,
      status: 'pending',
      createdAt: { $gte: startDate, $lt: endDate },
    }),
    Request.countDocuments({
      hospitalId: hospitalObjectId,
      status: { $in: ['pending', 'in-progress'] },
      createdAt: { $gte: startDate, $lt: endDate },
    }),
    Request.countDocuments({
      hospitalId: hospitalObjectId,
      completedAt: { $gte: startDate, $lt: endDate },
    }),
    Request.countDocuments({
      hospitalId: hospitalObjectId,
      cancelledAt: { $gte: startDate, $lt: endDate },
    }),
    Request.countDocuments({
      hospitalId: hospitalObjectId,
      status: { $nin: ['completed', 'cancelled'] },
      requiredBy: { $lt: now },
    }),
    Request.countDocuments({
      hospitalId: hospitalObjectId,
      status: { $nin: ['completed', 'cancelled'] },
      requiredBy: { $gte: now, $lte: in24h },
    }),
    Request.aggregate([
      { $match: { hospitalId: hospitalObjectId, status: { $nin: ['completed', 'cancelled'] }, requiredBy: { $ne: null } } },
      { $project: { daysRemaining: { $divide: [{ $subtract: ['$requiredBy', now] }, 1000 * 60 * 60 * 24] } } },
      { $group: { _id: null, avgDays: { $avg: '$daysRemaining' } } },
    ]),
    Donation.aggregate([
      ...donationLookupStages(hospitalObjectId, startDate, endDate, { status: 'completed' }),
      { $count: 'count' },
    ]),
    Donation.aggregate([
      ...donationLookupStages(hospitalObjectId, startDate, endDate, { status: { $in: ['confirmed', 'completed'] } }),
      { $group: { _id: '$donorId' } },
      { $count: 'count' },
    ]),
    Donation.aggregate([
      ...donationLookupStages(hospitalObjectId, startOfToday, endOfToday),
      { $count: 'count' },
    ]),
  ]);

  const totalRequests = requests.length;
  const totalResponses = donationsAgg.length;
  const emergencyRequests = requests.filter((r) => r.urgency === 'critical' || r.urgency === 'high').length;
  const completedDonations = completedDonationsAgg[0]?.count || 0;
  const confirmedDonorCount = confirmedDonorsAgg[0]?.count || 0;
  const avgDaysToRequiredBy = avgDaysResult[0]?.avgDays ? Math.round(avgDaysResult[0].avgDays * 10) / 10 : 0;
  const responsesToday = responsesTodayAgg[0]?.count || 0;

  return response.success(res, 200, 'Monthly report retrieved successfully', {
    month,
    totalRequests,
    openRequests: openCount,
    activeRequests: activeCount,
    totalCompleted: completedCount,
    totalCancelled: cancelledCount,
    emergencyRequests,
    responseCount: totalResponses,
    totalResponses,
    totalDonations: totalResponses,
    completedDonations,
    confirmedDonorCount,
    overdueCount,
    dueSoonCount,
    avgDaysToRequiredBy,
    recentActivityCount: totalResponses,
    recentCompletedDonationCount: completedDonations,
    responsesToday,
  });
});

const activityBloodTypeLabel = (request) => normalizeBloodTypeList(request?.bloodType).join(', ') || 'blood';

const toRequestActivity = (request) => ({
  type: request.status === 'completed' ? 'request_fulfilled' : 'request_created',
  title: `${request.status === 'completed' ? 'Request fulfilled' : 'Request created'} - ${activityBloodTypeLabel(request)}`,
  subtitle: request.status === 'completed'
    ? `units received ${request.unitsNeeded ?? 1}`
    : `units needed ${request.unitsNeeded ?? 1}`,
  status: request.status === 'completed' ? 'completed' : 'active',
  timestamp: (request.completedAt || request.createdAt).toISOString(),
});

const toDonorResponseActivity = (donation) => {
  const donor = donation.donorId;
  const request = donation.requestId;
  return {
    type: 'donor_response',
    title: `New donor response - ${donor?.fullName || 'Donor'}`,
    subtitle: `${donor?.bloodType || activityBloodTypeLabel(request)} donor responded`,
    status: request?.status === 'completed' ? 'completed' : 'active',
    timestamp: donation.createdAt.toISOString(),
    donorPhone: donor?.phoneNumber || null,
  };
};

export const getActivity = asyncHandler(async (req, res) => {
  const { limit } = parsePagination(req.query, 10);
  const hospitalObjectId = new mongoose.Types.ObjectId(req.user.userId);

  const [requests, donations] = await Promise.all([
    Request.find({ hospitalId: hospitalObjectId })
      .select('bloodType unitsNeeded status createdAt completedAt')
      .sort({ createdAt: -1 })
      .limit(limit),
    Donation.aggregate([
      {
        $lookup: {
          from: 'requests',
          localField: 'requestId',
          foreignField: '_id',
          as: 'request',
        },
      },
      { $unwind: '$request' },
      { $match: { 'request.hospitalId': hospitalObjectId } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
    ]),
  ]);

  const populatedDonations = await Donation.populate(donations, [
    { path: 'donorId', select: 'fullName phoneNumber bloodType' },
    { path: 'requestId', select: 'bloodType status' },
  ]);

  const activities = [
    ...requests.map(toRequestActivity),
    ...populatedDonations.map(toDonorResponseActivity),
  ]
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, limit);

  return response.success(res, 200, 'Hospital activity retrieved successfully', { activities });
});

export const getRequestHistory = asyncHandler(async (req, res) => {
  const { offset, limit, page } = parsePagination(req.query);
  const hospitalObjectId = new mongoose.Types.ObjectId(req.user.userId);
  const allowedStatuses = ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'];
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : null;

  if (status && !allowedStatuses.includes(status)) {
    throw new HttpError(400, `Invalid status filter. Allowed values: ${allowedStatuses.join(', ')}`);
  }

  const requestMatch = {
    hospitalId: hospitalObjectId,
    ...(status ? { status } : {}),
  };

  const requestsPipeline = [
    {
      $match: requestMatch,
    },
    {
      $lookup: {
        from: 'donations',
        localField: '_id',
        foreignField: 'requestId',
        as: 'donations',
      },
    },
    {
      $addFields: {
        donorsContacted: { $size: '$donations' },
        donorsConfirmed: {
          $size: {
            $filter: {
              input: '$donations',
              as: 'donation',
              cond: { $in: ['$$donation.status', ['scheduled', 'completed']] },
            },
          },
        },
        completionTimeInHours: {
          $cond: [
            { $and: [{ $ne: ['$createdAt', null] }, { $ne: ['$completedAt', null] }] },
            {
              $toInt: {
                $round: [
                  {
                    $divide: [
                      { $subtract: ['$completedAt', '$createdAt'] },
                      3600000,
                    ],
                  },
                  0,
                ],
              },
            },
            null,
          ],
        },
      },
    },
    {
      $project: {
        bloodType: 1,
        unitsRequested: '$unitsNeeded',
        urgencyLevel: '$urgency',
        donorsContacted: 1,
        donorsConfirmed: 1,
        isFulfilled: { $eq: ['$status', 'completed'] },
        requestDate: '$createdAt',
        completionTimeInHours: 1,
        priority: '$urgency',
        location: {
          $let: {
            vars: {
              lat: {
                $ifNull: [
                  '$hospitalLocation.lat',
                  {
                    $ifNull: [
                      '$locationHospital.latitude',
                      {
                        $arrayElemAt: ['$hospitalLocationGeo.coordinates', 1],
                      },
                    ],
                  },
                ],
              },
              lng: {
                $ifNull: [
                  '$hospitalLocation.lng',
                  {
                    $ifNull: [
                      '$locationHospital.longitude',
                      {
                        $arrayElemAt: ['$hospitalLocationGeo.coordinates', 0],
                      },
                    ],
                  },
                ],
              },
            },
            in: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$$lat', null] },
                    { $ne: ['$$lng', null] },
                  ],
                },
                { coordinates: { lat: '$$lat', lng: '$$lng' } },
                null,
              ],
            },
          },
        },
        hospitalContact: { $ifNull: ['$contactNumber', '$hospitalContact'] },
        hospitalName: 1,
        status: 1,
        _id: 1,
      },
    },
    { $sort: { requestDate: -1 } },
  ];

  const [requests, totalResult] = await Promise.all([
    Request.aggregate([
      ...requestsPipeline,
      { $skip: offset },
      { $limit: limit },
    ]),
    Request.aggregate([
      ...requestsPipeline,
      { $count: 'count' },
    ]),
  ]);

  const total = totalResult[0]?.count || 0;

  const statsResult = await Request.aggregate([
    { $match: { hospitalId: hospitalObjectId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const statusCounts = statsResult.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const activeRequests =
    (statusCounts.pending || 0) +
    (statusCounts.accepted || 0) +
    (statusCounts['in-progress'] || 0);
  const completedRequests = statusCounts.completed || 0;
  const cancelledRequests = statusCounts.cancelled || 0;

  response.success(res, 200, 'Request history retrieved successfully', {
    statistics: {
      activeRequests,
      completedRequests,
      cancelledRequests,
    },
    requests,
    pagination: paginationMeta(total, page, limit),
  });
});

export const createHospital = asyncHandler(async (req, res) => {
  const validation = validateCreateHospitalByAdminBody(req.body);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors.join(', '));
  }

  try {
    const result = await hospitalService.createHospitalByAdmin(req.body, req.user._id);
    return response.success(res, 201, 'Hospital created successfully', result);
  } catch (error) {
    if (error.message === 'Email already registered') {
      throw new HttpError(409, error.message);
    }
    throw error;
  }
});
