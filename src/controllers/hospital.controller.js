import response from '../utils/response.js';
import mongoose from 'mongoose';
import Hospital from '../models/Hospital.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import * as notificationService from '../services/notification.service.js';
import * as matchingService from '../services/matching.service.js';
import * as appointmentService from '../services/appointment.service.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import HospitalSettings from '../models/HospitalSettings.model.js';
import * as adminService from '../services/admin.service.js';
import * as hospitalService from '../services/hospital.service.js';
import { validateCreateHospitalByAdminBody } from '../validation/admin.validation.js';
import { DEFAULT_SUPPORTED_DONATION_TYPES, DONATION_TYPE_LABELS, DONATION_TYPE_OPTIONS } from '../constants/donation.constants.js';

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

export const findDonors = async (req, res, next) => {
  try {
    const bloodType = typeof req.query.bloodType === 'string' && req.query.bloodType.trim()
      ? req.query.bloodType.replace(/\s+/g, '+').trim().toUpperCase()
      : null;
    const radiusKm = toNumber(req.query.radiusKm) ?? 5;
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);
    const availability = parseBooleanQuery(req.query.availability, true);
    const { page, limit, offset } = parsePagination(req.query, 20);

    if (bloodType && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodType)) {
      return response.error(res, 400, 'Invalid bloodType');
    }

    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      return response.error(res, 400, 'radiusKm must be a positive number');
    }

    if (lat !== null && (lat < -90 || lat > 90)) {
      return response.error(res, 400, 'lat must be between -90 and 90');
    }

    if (lng !== null && (lng < -180 || lng > 180)) {
      return response.error(res, 400, 'lng must be between -180 and 180');
    }

    if ((lat === null) !== (lng === null)) {
      return response.error(res, 400, 'lat and lng must be provided together');
    }

    if (availability === null) {
      return response.error(res, 400, 'availability must be a boolean value');
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
      availability,
      radiusKm,
      location: searchLocation,
    });

    const donors = matches.map(({ donor, distanceKm }) => ({
      donorId: donor._id.toString(),
      fullName: donor.fullName,
      bloodType: donor.bloodType,
      email: donor.email || null,
      distance: formatDistance(distanceKm),
      distanceKm,
      distanceMeters: distanceKm === null ? null : Math.round(distanceKm * 1000),
      isAvailable: Boolean(donor.isAvailable),
      phoneNumber: donor.phoneNumber || null,
      location: toLocation(donor.location?.coordinates),
    }));

    const paginatedDonors = donors.slice(offset, offset + limit);
    const pagination = paginationMeta(donors.length, page, limit);

    return res.status(200).json({
      success: true,
      message: 'Nearby donors retrieved successfully',
      data: {
        donors: paginatedDonors,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          totalPages: pagination.totalPages,
        },
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
    if (!normalizedAppointmentDate || Number.isNaN(normalizedAppointmentDate.getTime())) {
      return response.error(res, 400, 'appointmentDate is required');
    }

    const normalizedDonationType = donationType || DONATION_TYPE_LABELS.WHOLE_BLOOD;
    if (!DONATION_TYPE_OPTIONS.includes(normalizedDonationType)) {
      return response.error(res, 400, 'Invalid donation type');
    }

    const appointment = await appointmentService.bookAppointment(
      donorId,
      req.user.userId,
      requestId || null,
      normalizedAppointmentDate,
      notes || '',
      normalizedDonationType
    );

    const appointmentObj = appointment.toObject ? appointment.toObject() : appointment;

    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: appointmentObj,
    });
  } catch (error) {
    if (error.message === 'Donor not found' || error.message === 'Hospital not found' || error.message === 'Request not found') {
      return response.error(res, 404, error.message);
    }
    if (
      error.message === 'Invalid donor or hospital id' ||
      error.message === 'Invalid appointment id' ||
      error.message === 'Invalid request id' ||
      error.message === 'Appointment date must be in the future' ||
      error.message === 'Request does not belong to this hospital' ||
      error.message === 'Donor is not currently available' ||
      error.message === 'Donor is suspended' ||
      error.message === 'Donor has not provided blood type information' ||
      error.message.startsWith('Donor blood type ') ||
      error.message.startsWith('Must wait ')
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

// Get hospital's requests — supports ?page=1&limit=10
export const getRequests = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const { offset, limit, page } = parsePagination(req.query);

    const filter = { hospitalId: req.user.userId };

    if (status && ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'expired'].includes(status)) {
      filter.status = status;
    }
    if (type && ['blood', 'organ'].includes(type)) {
      filter.type = type;
    }

    const [requests, total] = await Promise.all([
      Request.find(filter).skip(offset).limit(limit).sort({ createdAt: -1 }),
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

// Get donations for hospital's requests — supports ?page=1&limit=10
export const getDonations = async (req, res, next) => {
  try {
    const { status } = req.query;
    const { offset, limit, page } = parsePagination(req.query);

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
        .skip(offset)
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
