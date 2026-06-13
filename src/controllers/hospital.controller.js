import response from '../utils/response.js';
import mongoose from 'mongoose';
import Hospital from '../models/Hospital.model.js';
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
import { validateCreateHospitalByAdminBody } from '../validation/admin.validation.js';
import { DEFAULT_SUPPORTED_DONATION_TYPES, DONATION_TYPE_LABELS, DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';
import {
  validateFindDonorsQuery,
  validateBookAppointmentBody,
  validateCreateRequestBody,
  validateCreateEmergencyRequestBody,
} from '../validation/hospital.validation.js';
import { normalizeBloodTypeList, extractFirstBloodType } from '../utils/blood-type.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { validateTransition } from '../utils/state-machine.js';

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

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBooleanQuery = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return null;
};

const EMERGENCY_REQUEST_REQUIRED_BY_MS = 24 * 60 * 60 * 1000;

const toLocation = (coordinates) => {
  const lat = Number(coordinates?.lat ?? coordinates?.latitude);
  const lng = Number(coordinates?.lng ?? coordinates?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
  };
};

const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(2)} km`;
};

const buildAppointmentDate = ({ appointmentDate, date, time }) => {
  if (appointmentDate) return new Date(appointmentDate);
  if (!date) return null;

  const scheduledDate = new Date(date);
  if (Number.isNaN(scheduledDate.getTime())) return null;

  if (time) {
    const match = String(time).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    scheduledDate.setHours(hour, minute, 0, 0);
  }

  return scheduledDate;
};
    
const resolveHospitalCoordinates = (hospital) => {
  const latitude = toNumber(hospital?.location?.coordinates?.lat ?? hospital?.lat);
  const longitude = toNumber(hospital?.location?.coordinates?.lng ?? hospital?.long);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

const APPOINTMENT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
const DEFAULT_APPOINTMENT_CLOSING_TIME = '19:00';
const DEFAULT_APPOINTMENT_WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_APPOINTMENT_PREPARATION_TIPS = [
  'Eat a healthy meal before donation',
  'Drink plenty of water',
  'Bring a valid ID',
  "Get a good night's sleep",
];
const APPOINTMENT_TIME_PATTERN = /^(?:[01]\d|2[0-3]):00$/;

const formatHourLabel = (hour) => `${String(hour).padStart(2, '0')}:00`;

const parseHourLabel = (value) => {
  if (typeof value !== 'string' || !APPOINTMENT_TIME_PATTERN.test(value)) {
    return null;
  }

  const [hourPart, minutePart] = value.split(':').map(Number);
  if (minutePart !== 0) {
    return null;
  }

  return hourPart;
};

const toPlainObject = (value) => {
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject();
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
};

const buildHourlySlots = (openingTime, closingTime, slotsPerHour, preservedSlots = {}, overrides = {}) => {
  const startHour = parseHourLabel(openingTime);
  const endHour = parseHourLabel(closingTime);

  if (startHour === null || endHour === null || endHour <= startHour) {
    return null;
  }

  const preserved = toPlainObject(preservedSlots);
  const provided = toPlainObject(overrides);
  const hourlySlots = {};

  for (let hour = startHour; hour < endHour; hour += 1) {
    const label = formatHourLabel(hour);

    if (Object.prototype.hasOwnProperty.call(provided, label)) {
      hourlySlots[label] = Number(provided[label]);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(preserved, label)) {
      hourlySlots[label] = Number(preserved[label]);
      continue;
    }

    hourlySlots[label] = Number(slotsPerHour);
  }

  return hourlySlots;
};

const sumHourlySlots = (hourlySlots = {}) => Object.values(hourlySlots).reduce((total, value) => total + Number(value || 0), 0);

const getDefaultAppointmentSettings = () => {
  const hourlySlots = buildHourlySlots(
    DEFAULT_APPOINTMENT_OPENING_TIME,
    DEFAULT_APPOINTMENT_CLOSING_TIME,
    4
  );

  return {
    openingTime: DEFAULT_APPOINTMENT_OPENING_TIME,
    closingTime: DEFAULT_APPOINTMENT_CLOSING_TIME,
    workingDays: [...DEFAULT_APPOINTMENT_WORKING_DAYS],
    defaultSlotsPerHour: 4,
    hourlySlots,
    totalDailyCapacity: sumHourlySlots(hourlySlots),
    isActive: true,
    supportedDonationTypes: [...DEFAULT_SUPPORTED_DONATION_TYPES],
    minAdvanceHours: 24,
    maxAdvanceDays: 30,
    preparationTips: [...DEFAULT_APPOINTMENT_PREPARATION_TIPS],
    rescheduleAllowed: true,
    maxReschedules: 3,
    cancellationAllowedHours: 12,
  };
};

const normalizeAppointmentSettings = (settings, payload = {}) => {
  const current = {
    ...getDefaultAppointmentSettings(),
    ...(settings || {}),
  };

  const errors = [];

  const openingTime = payload.openingTime ?? current.openingTime;
  const closingTime = payload.closingTime ?? current.closingTime;
  const defaultSlotsPerHour = payload.defaultSlotsPerHour ?? current.defaultSlotsPerHour;

  if (typeof openingTime !== 'string' || !APPOINTMENT_TIME_PATTERN.test(openingTime)) {
    errors.push('openingTime must be in HH:mm format and aligned to the hour');
  }

  if (typeof closingTime !== 'string' || !APPOINTMENT_TIME_PATTERN.test(closingTime)) {
    errors.push('closingTime must be in HH:mm format and aligned to the hour');
  }

  const startHour = parseHourLabel(openingTime);
  const endHour = parseHourLabel(closingTime);
  if (startHour !== null && endHour !== null && endHour <= startHour) {
    errors.push('closingTime must be later than openingTime');
  }

  if (!Number.isInteger(Number(defaultSlotsPerHour)) || Number(defaultSlotsPerHour) < 1 || Number(defaultSlotsPerHour) > 100) {
    errors.push('defaultSlotsPerHour must be an integer between 1 and 100');
  }

  const validateStringArray = (value, fieldName, allowedValues, allowEmpty = true) => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      errors.push(`${fieldName} must be an array`);
      return undefined;
    }

    const normalized = [];
    for (const item of value) {
      if (typeof item !== 'string' || !allowedValues.includes(item)) {
        errors.push(`${fieldName} contains an invalid value: ${item}`);
        continue;
      }
      if (!normalized.includes(item)) {
        normalized.push(item);
      }
    }

    if (!allowEmpty && normalized.length === 0) {
      errors.push(`${fieldName} must contain at least one value`);
    }

    return normalized;
  };

  const workingDays = validateStringArray(payload.workingDays, 'workingDays', APPOINTMENT_DAYS);
  const supportedDonationTypes = validateStringArray(
    payload.supportedDonationTypes,
    'supportedDonationTypes',
    DEFAULT_SUPPORTED_DONATION_TYPES
  );

  const preparationTips = payload.preparationTips === undefined
    ? undefined
    : Array.isArray(payload.preparationTips) && payload.preparationTips.every((tip) => typeof tip === 'string' && tip.trim())
      ? payload.preparationTips
      : (() => {
          errors.push('preparationTips must be an array of non-empty strings');
          return undefined;
        })();

  const booleanFields = ['isActive', 'rescheduleAllowed'];
  for (const field of booleanFields) {
    if (payload[field] !== undefined && typeof payload[field] !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    }
  }

  const numericFields = [
    ['minAdvanceHours', 0, 3650],
    ['maxAdvanceDays', 0, 3650],
    ['maxReschedules', 0, 100],
    ['cancellationAllowedHours', 0, 3650],
  ];
  for (const [field, minValue, maxValue] of numericFields) {
    if (payload[field] === undefined) continue;
    const value = Number(payload[field]);
    if (!Number.isInteger(value) || value < minValue || value > maxValue) {
      errors.push(`${field} must be an integer between ${minValue} and ${maxValue}`);
    }
  }

  let quickActionValue;
  if (payload.setAllSlotsTo !== undefined && payload.closeAllSlots !== undefined) {
    errors.push('Use either setAllSlotsTo or closeAllSlots, not both');
  }

  if (payload.setAllSlotsTo !== undefined) {
    const value = Number(payload.setAllSlotsTo);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      errors.push('setAllSlotsTo must be an integer between 0 and 100');
    } else {
      quickActionValue = value;
    }
  }

  if (payload.closeAllSlots !== undefined && typeof payload.closeAllSlots !== 'boolean') {
    errors.push('closeAllSlots must be a boolean');
  }

  const providedHourlySlots = payload.hourlySlots && typeof payload.hourlySlots === 'object' && !Array.isArray(payload.hourlySlots)
    ? payload.hourlySlots
    : undefined;

  if (payload.hourlySlots !== undefined && !providedHourlySlots) {
    errors.push('hourlySlots must be an object keyed by HH:mm');
  }

  const generatedHourlySlots = buildHourlySlots(
    openingTime,
    closingTime,
    defaultSlotsPerHour,
    current.hourlySlots,
    providedHourlySlots || {}
  );

  if (!generatedHourlySlots) {
    errors.push('hourlySlots could not be generated for the supplied openingTime and closingTime');
  }

  if (providedHourlySlots && generatedHourlySlots) {
    const allowedKeys = new Set(Object.keys(generatedHourlySlots));
    for (const [hour, value] of Object.entries(providedHourlySlots)) {
      if (!APPOINTMENT_TIME_PATTERN.test(hour) || !allowedKeys.has(hour)) {
        errors.push(`hourlySlots contains an invalid time key: ${hour}`);
        continue;
      }

      const numericValue = Number(value);
      if (!Number.isInteger(numericValue) || numericValue < 0 || numericValue > 100) {
        errors.push(`hourlySlots.${hour} must be an integer between 0 and 100`);
      }
    }
  }

  if (errors.length) {
    return { errors };
  }

  const hourlySlots = {};
  for (const hour of Object.keys(generatedHourlySlots)) {
    if (payload.closeAllSlots === true) {
      hourlySlots[hour] = 0;
      continue;
    }

    if (quickActionValue !== undefined) {
      hourlySlots[hour] = quickActionValue;
      continue;
    }

    if (providedHourlySlots && providedHourlySlots[hour] !== undefined) {
      hourlySlots[hour] = Number(providedHourlySlots[hour]);
      continue;
    }

    hourlySlots[hour] = Number(generatedHourlySlots[hour]);
  }

  return {
    errors: [],
    appointmentSettings: {
      openingTime,
      closingTime,
      workingDays: workingDays ?? current.workingDays,
      defaultSlotsPerHour: Number(defaultSlotsPerHour),
      hourlySlots,
      totalDailyCapacity: sumHourlySlots(hourlySlots),
      isActive: payload.isActive !== undefined ? payload.isActive : current.isActive ?? true,
      supportedDonationTypes: supportedDonationTypes ?? current.supportedDonationTypes,
      minAdvanceHours: payload.minAdvanceHours !== undefined ? Number(payload.minAdvanceHours) : current.minAdvanceHours,
      maxAdvanceDays: payload.maxAdvanceDays !== undefined ? Number(payload.maxAdvanceDays) : current.maxAdvanceDays,
      preparationTips: preparationTips ?? current.preparationTips,
      rescheduleAllowed: payload.rescheduleAllowed !== undefined ? payload.rescheduleAllowed : current.rescheduleAllowed ?? true,
      maxReschedules: payload.maxReschedules !== undefined ? Number(payload.maxReschedules) : current.maxReschedules,
      cancellationAllowedHours: payload.cancellationAllowedHours !== undefined
        ? Number(payload.cancellationAllowedHours)
        : current.cancellationAllowedHours,
    },
  };
};

const getOrCreateHospitalSettings = async (hospitalId) => {
  let settings = await HospitalSettings.findOne({ hospitalId });

  if (!settings) {
    settings = new HospitalSettings({
      hospitalId,
      appointmentSettings: getDefaultAppointmentSettings(),
    });
    await settings.save();
    return settings;
  }

  if (!settings.appointmentSettings) {
    settings.appointmentSettings = getDefaultAppointmentSettings();
    await settings.save();
  }

  return settings;
};

/**
 * Hospital Controller - Handles hospital-specific operations
 */

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
    totalDonations: completedDonations,
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
      totalDonations: 0,
      completedDonations: 0,
    },
  };
};

// Get hospital profile
export const getProfile = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.user.userId).select('-password');
    if (!hospital) {
      return response.error(res, 404, 'Hospital profile not found');
    }
    const stats = await buildHospitalProfileStats(req.user.userId);
    response.success(res, 200, 'Hospital profile retrieved successfully', toHospitalProfilePayload(hospital, stats));
  } catch (error) {
    next(error);
  }
};

export const toHospitalRequestResponse = (requestDoc) => {
  const request = requestDoc?.toObject ? requestDoc.toObject() : { ...requestDoc };
  const unitsNeeded = Number(request.unitsNeeded ?? request.quantity ?? 1);
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
    hospital: hospital
      ? {
          id: hospital._id?.toString?.() || null,
          name: hospital.hospitalName || hospital.fullName || null,
          hospitalName: hospital.hospitalName || hospital.fullName || null,
        }
      : request.hospitalId
        ? { id: request.hospitalId.toString(), name: request.hospitalName || null, hospitalName: request.hospitalName || null }
        : null,
  };
};

export const findDonors = async (req, res, next) => {
  try {
    const bloodType = typeof req.query.bloodType === 'string' && req.query.bloodType.trim()
      ? req.query.bloodType.replace(/\s+/g, '+').trim().toUpperCase()
      : null;
    const radiusKm = toNumber(req.query.radiusKm) ?? 5;
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);
    const participation = req.query.participation !== undefined
      ? parseBooleanQuery(req.query.participation, true)
      : parseBooleanQuery(req.query.availability, true);
    const { page, limit, offset } = parsePagination(req.query, 20);

    const validation = validateFindDonorsQuery(req.query, lat, lng, radiusKm, participation);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    let searchCoordinates = lat !== null && lng !== null ? { latitude: lat, longitude: lng } : null;

    if (!searchCoordinates) {
      if (req.user.role !== 'hospital') {
        return response.error(res, 400, 'lat and lng are required for admin and superadmin users');
      }

      const hospital = await Hospital.findById(req.user.userId).select('location lat long');
      if (!hospital) {
        return response.error(res, 404, 'Hospital profile not found');
      }

      searchCoordinates = resolveHospitalCoordinates(hospital);
      if (!searchCoordinates) {
        return response.error(res, 400, 'Hospital coordinates are required to search for donors');
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

    return response.success(res, 200, 'Nearby donors retrieved successfully', {
      donors: paginatedDonors,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const bookDonorAppointment = async (req, res, next) => {
  try {
    const donorId = req.params.donorId;
    const { appointmentDate, date, time, notes, donationType, requestId } = req.body;

    if (!donorId) {
      return response.error(res, 400, 'donorId is required');
    }

    const normalizedAppointmentDate = buildAppointmentDate({ appointmentDate, date, time });
    const validation = validateBookAppointmentBody(req.body, normalizedAppointmentDate);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    const normalizedDonationType = donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD;

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
      return response.error(res, 404, error.message);
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
      return response.error(res, 400, error.message);
    }
    if (error.message === 'You already have an active appointment at this hospital') {
      return response.error(res, 409, error.message);
    }
    next(error);
  }
};

// Update hospital profile
export const updateProfile = async (req, res, next) => {
  try {
    const { fullName, hospitalName, contactNumber, address, location } = req.body;

    const hospital = await Hospital.findById(req.user.userId);
    if (!hospital) {
      return response.error(res, 404, 'Hospital profile not found');
    }

    if (fullName) hospital.fullName = fullName;
    if (hospitalName) hospital.hospitalName = hospitalName;
    if (contactNumber) hospital.contactNumber = contactNumber;
    if (address) {
      hospital.address = {
        ...address,
        ...(address.governrate && !address.governorate ? { governorate: address.governrate } : {}),
      };
      delete hospital.address.governrate;
    }
    const normalizedLocation = normalizeLocationInput(location);
    if (normalizedLocation) hospital.location = normalizedLocation;

    await hospital.save();

    const stats = await buildHospitalProfileStats(req.user.userId);

    response.success(res, 200, 'Hospital profile updated successfully', toHospitalProfilePayload(hospital, stats));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

// Create a donation request
const createRequestFromHospital = async (req, res, next, { emergencyOnly = false } = {}) => {
  try {
    const validation = emergencyOnly
      ? validateCreateEmergencyRequestBody(req.body)
      : validateCreateRequestBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    const hospital = await Hospital.findById(req.user.userId).select('contactNumber location fullName hospitalName');
    if (!hospital) {
      return response.error(res, 404, 'Hospital profile not found');
    }

    if (!hospital.contactNumber) {
      return response.error(res, 400, 'Hospital contact number is required before creating a request');
    }

    const locationLatitude = hospital?.location?.coordinates?.lat;
    const locationLongitude = hospital?.location?.coordinates?.lng;

    const requestData = emergencyOnly
      ? {
          hospitalId: req.user.userId,
          hospitalContact: hospital.contactNumber,
          contactNumber: hospital.contactNumber,
          type: 'blood',
          urgency: 'critical',
          requiredBy: new Date(Date.now() + EMERGENCY_REQUEST_REQUIRED_BY_MS),
          quantity: validation.unitsNeeded,
          unitsNeeded: validation.unitsNeeded,
          patientType: validation.patientDetails,
          isEmergency: true,
          notes: validation.patientDetails,
          bloodType: validation.bloodTypes,
        }
      : (() => {
          const {
            type,
            bloodType,
            bloodTypes,
            urgency,
            requiredBy,
            quantity,
            unitsNeeded,
            patientType,
            contactNumber,
            isEmergency,
            notes,
            patientDetails,
          } = req.body;

          const bloodTypeInput = bloodTypes !== undefined ? bloodTypes : bloodType;
          const normalizedBloodTypes = validation.bloodTypes?.length > 0
            ? validation.bloodTypes
            : normalizeBloodTypeList(bloodTypeInput);

          const requiredByDate = new Date(requiredBy);
          const resolvedUnits = Number(unitsNeeded ?? quantity ?? 1);
          const resolvedUrgency = isEmergency === true ? 'critical' : urgency;

          return {
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
            notes: notes || patientDetails || '',
            ...(normalizedBloodTypes.length > 0 ? { bloodType: normalizedBloodTypes } : {}),
          };
        })();

    // Snapshot hospital location and display name at time of request
    requestData.locationHospital = {
      latitude: locationLatitude,
      longitude: locationLongitude,
    };
    requestData.hospitalLocation = {
      lat: locationLatitude,
      lng: locationLongitude,
    };
    if (Number.isFinite(locationLatitude) && Number.isFinite(locationLongitude)) {
      requestData.hospitalLocationGeo = {
        type: 'Point',
        coordinates: [locationLongitude, locationLatitude],
      };
    }
    requestData.hospitalName = hospital?.hospitalName || hospital?.fullName;


    const session = await mongoose.startSession();
    let donRequest = null;
    let outboxEntry = null;

    try {
      await session.withTransaction(async () => {
        const docs = await Request.create([requestData], { session });
        donRequest = docs[0];

        // Create an outbox entry atomically with the request so we never lose intent
        if (requestData.isEmergency) {
          // Only create an outbox entry when mongoose is connected. Unit tests
          // mock many models and do not initialize a DB connection — creating
          // an outbox against an unconnected mongoose instance can hang tests.
          if (mongoose.connection && mongoose.connection.readyState === 1) {
            const outboxDocs = await NotificationOutbox.create([
              {
                requestId: donRequest._id,
                donorIds: [],
                status: 'pending',
              },
            ]);
            outboxEntry = outboxDocs[0];
          }
        }
      });
    } finally {
      session.endSession();
    }

    await donRequest.populate('hospitalId', 'fullName hospitalName address contactNumber');

    response.success(res, 201, 'Donation request created successfully', toHospitalRequestResponse(donRequest));

    if (requestData.isEmergency) {
      try {
        const compatibleDonors = await matchingService.findCompatibleDonors(donRequest._id);
        const donorIds = compatibleDonors.map(({ donor }) => donor._id);

        // If outbox was created, update it with recipient ids and mark ready
        if (outboxEntry) {
          try {
            await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { donorIds, status: 'ready' });
          } catch (ignore) {
            // best-effort
          }
        }

        if (donorIds.length > 0) {
          try {
            await notificationService.notifyRequest(donorIds, donRequest);
            if (outboxEntry) {
              await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { status: 'sent', attempts: 1, lastError: null });
            }
          } catch (notifyErr) {
            if (outboxEntry) {
              await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { status: 'failed', attempts: 1, lastError: String(notifyErr?.message || notifyErr) });
            }
          }
        } else if (outboxEntry) {
          // No recipients found, mark outbox as sent with zero attempts
          await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { status: 'sent', attempts: 0 });
        }
      } catch (err) {
        // If matching or outbox update fails, log but do not rollback creation
        try {
          if (outboxEntry) {
            await NotificationOutbox.findByIdAndUpdate(outboxEntry._id, { status: 'failed', lastError: String(err?.message || err) });
          }
        } catch (ignore) {}
      }
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

export const createRequest = async (req, res, next) => createRequestFromHospital(req, res, next, { emergencyOnly: false });

export const createEmergencyRequest = async (req, res, next) => createRequestFromHospital(req, res, next, { emergencyOnly: true });

// Get hospital's requests — supports ?page=1&limit=10
export const getRequests = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const { offset, limit, page } = parsePagination(req.query);

    const filter = { hospitalId: req.user.userId };

    if (status && ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'].includes(status)) {
      filter.status = status;
    }
    if (type && ['blood', 'plasma', 'platelets', 'double_red_cells'].includes(type)) {
      filter.type = type;
    }

    const [requests, total] = await Promise.all([
      Request.find(filter).skip(offset).limit(limit).sort({ createdAt: -1 }),
      Request.countDocuments(filter),
    ]);

    response.success(res, 200, 'Requests retrieved successfully', {
      requests: requests.map(toHospitalRequestResponse),
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

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
    bloodTypes: request.bloodType,
    unitsNeeded: request.unitsNeeded,
    urgency: request.urgency,
    timeRemaining,
    responded,
    confirmed,
  };
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

    const responseData = formatRequestDetailResponse(request, donations);
    response.success(res, 200, 'Request details retrieved successfully', responseData);
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

    // No-op: if the request is already in the desired state, return success.
    if (request.status === status) {
      const donations = await Donation.find({ requestId: request._id });
      const responseData = formatRequestDetailResponse(request, donations);
      return response.success(res, 200, 'Request status updated successfully', responseData);
    }

    // Guard: validate transition through the centralized state machine.
    try {
      validateTransition('request', request.status, status);
    } catch (err) {
      return response.error(res, 400, err.message);
    }

    if (status === 'completed') {
      const completedDonation = await Donation.findOne({
        requestId: request._id,
        status: 'completed',
      });
      if (!completedDonation) {
        return response.error(res, 400, 'Cannot complete request: no completed donation found for this request. Use cancel instead.');
      }
    }

    if (status === 'accepted' && !request.acceptedDonationId) {
      return response.error(res, 400, 'Cannot mark request accepted without an accepted donation');
    }

    // runValidators is intentionally omitted: past requiredBy date would fail
    // validation on legitimate status updates (e.g. marking an old request completed)
    const session = await mongoose.startSession();
    let updatedRequest;
    const cancelledAt = new Date();
    try {
      await session.withTransaction(async () => {
        updatedRequest = await Request.findByIdAndUpdate(
          requestId,
          { status },
          { returnDocument: 'after', session }
        );

        if (['completed', 'cancelled', 'expired'].includes(status)) {
          await appointmentService.cancelActiveAppointmentsForRequest(requestId, {
            cancelledAt,
            notes: `Appointment cancelled because request was marked as ${status}`,
            session,
          });
        }
      });
    } finally {
      session.endSession();
    }

    const donations = await Donation.find({ requestId: updatedRequest._id });
    const responseData = formatRequestDetailResponse(updatedRequest, donations);
    response.success(res, 200, 'Request status updated successfully', responseData);
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

    // Guard: only non-terminal requests can be cancelled.
    try {
      validateTransition('request', request.status, 'cancelled');
    } catch (err) {
      return response.error(res, 400, err.message);
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
  } catch (error) {
    next(error);
  }
};

// Get donations for hospital's requests — supports ?page=1&limit=10
export const getDonations = async (req, res, next) => {
  try {
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

// Removed: `getBloodInventory` handler — hospital inventory access consolidated
// to the admin summary endpoint. Use `GET /admin/blood-inventory-summary` instead.

// GET /hospital/appointments - upcoming appointments for the hospital
export const getAppointments = async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

// GET /hospital/appointments/:appointmentId - single appointment details for hospital
export const getAppointmentDetails = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    if (!appointmentId) return response.error(res, 400, 'appointmentId is required');
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) return response.error(res, 400, 'Invalid appointment id');

    const appointment = await Appointment.findOne({ _id: appointmentId, hospitalId: req.user.userId });
    if (!appointment) return response.error(res, 404, 'Appointment not found');

    await appointment.populate(appointmentPopulateOptions);
    await appointment.populate({ path: 'requestId', select: 'type bloodType organType urgency hospitalId' });

    const appointmentResponse = toAppointmentResponse(appointment);
    return response.success(res, 200, 'Appointment retrieved successfully', appointmentResponse);
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

    // Requests created in the month
    const requests = await Request.find({
      hospitalId: hospitalObjectId,
      createdAt: { $gte: startDate, $lt: endDate },
    }).select('status urgency requiredBy createdAt');

    const totalRequests = requests.length;
    const openRequests = requests.filter((r) => r.status === 'pending').length;
    const activeRequests = requests.filter((r) => ['pending', 'in-progress'].includes(r.status)).length;
    const totalCompleted = requests.filter((r) => r.status === 'completed').length;
    const totalCancelled = requests.filter((r) => r.status === 'cancelled').length;
    const emergencyRequests = requests.filter((r) => r.urgency === 'critical' || r.urgency === 'high').length;

    // Donations for requests that were created in the month (join by request.createdAt)
    const donationsAgg = await Donation.aggregate([
      { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
      { $unwind: '$request' },
      { $match: { 'request.hospitalId': hospitalObjectId, 'request.createdAt': { $gte: startDate, $lt: endDate } } },
    ]);

    const responseCount = donationsAgg.length;
    const totalResponses = donationsAgg.length;
    const confirmedDonorCount = new Set(donationsAgg.filter((d) => ['scheduled', 'completed'].includes(d.status)).map((d) => d.donorId?.toString())).size;

    // Request deadline metrics
    const now = new Date();
    const dueSoonThreshold = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const overdueCount = requests.filter((r) => r.requiredBy && r.requiredBy < now && r.status !== 'completed').length;
    const dueSoonCount = requests.filter((r) => r.requiredBy && r.requiredBy >= now && r.requiredBy <= dueSoonThreshold && r.status !== 'completed').length;
    const avgDaysToRequiredBy = requests.length
      ? Math.round(
          requests.reduce((sum, r) => sum + ((r.requiredBy?.getTime() || 0) - r.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) /
            requests.length
        )
      : 0;

    // Recent activity (donations) in last 7 days for this hospital
    const recentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentAgg = await Donation.aggregate([
      { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
      { $unwind: '$request' },
      { $match: { 'request.hospitalId': hospitalObjectId, createdAt: { $gte: recentStart } } },
      { $count: 'count' },
    ]);
    const recentActivityCount = recentAgg[0]?.count || 0;
    const recentCompletedDonationAgg = await Donation.aggregate([
      { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
      { $unwind: '$request' },
      {
        $match: {
          'request.hospitalId': hospitalObjectId,
          createdAt: { $gte: recentStart },
          status: 'completed',
        },
      },
      { $count: 'count' },
    ]);
    const recentCompletedDonationCount = recentCompletedDonationAgg[0]?.count || 0;

    // Donations created today for this hospital (used by Hospital dashboard widget)
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const responsesTodayAgg = await Donation.aggregate([
      { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
      { $unwind: '$request' },
      {
        $match: {
          'request.hospitalId': hospitalObjectId,
          createdAt: { $gte: startOfToday, $lt: endOfToday },
        },
      },
      { $count: 'count' },
    ]);
    const responsesToday = responsesTodayAgg[0]?.count || 0;

    return response.success(res, 200, 'Monthly report retrieved successfully', {
      month,
      totalRequests,
      openRequests,
      activeRequests,
      totalCompleted,
      totalCancelled,
      emergencyRequests,
      responseCount,
      totalResponses,
      totalDonations: totalResponses,
      completedDonations: donationsAgg.filter((d) => d.status === 'completed').length,
      confirmedDonorCount,
      overdueCount,
      dueSoonCount,
      avgDaysToRequiredBy,
      recentActivityCount,
      recentCompletedDonationCount,
      responsesToday,
    });
  } catch (error) {
    next(error);
  }
};

export const getRequestHistory = async (req, res, next) => {
  try {
    const { offset, limit, page } = parsePagination(req.query);
    const hospitalObjectId = new mongoose.Types.ObjectId(req.user.userId);
    const allowedStatuses = ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'];
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : null;

    if (status && !allowedStatuses.includes(status)) {
      return response.error(
        res,
        400,
        `Invalid status filter. Allowed values: ${allowedStatuses.join(', ')}`
      );
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
    next(error);
  }
};


// GET /hospital/appointment-settings
export const getAppointmentSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateHospitalSettings(req.user.userId);
    return response.success(res, 200, 'Appointment settings retrieved successfully', settings.appointmentSettings);
  } catch (error) {
    next(error);
  }
};

// PUT /hospital/appointment-settings
export const updateAppointmentSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateHospitalSettings(req.user.userId);
    const normalized = normalizeAppointmentSettings(settings.appointmentSettings, req.body);

    if (normalized.errors.length) {
      return response.error(res, 400, normalized.errors.join(', '));
    }

    settings.appointmentSettings = normalized.appointmentSettings;
    await settings.save();

    return response.success(res, 200, 'Appointment settings updated successfully', settings.appointmentSettings);
  } catch (error) {
    next(error);
  }
};
