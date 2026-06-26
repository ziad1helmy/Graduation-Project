import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import Appointment from '../models/Appointment.model.js';
import { env } from '../config/env.js';
import * as geoUtil from '../utils/geo.js';
import { canDonate, hasActiveDonationInProgress } from './eligibility.service.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { logger } from '../utils/logger.js';
import {
  getCompatibleDonorTypesForRequest,
  isBloodTypeCompatibleWithAnyRequestType,
  normalizeBloodTypeList,
} from '../utils/blood-type.js';

/**
 * Matching Service - Finds compatible donors for requests and vice versa
 */

const DEFAULT_MATCHING_DISTANCE_KM = (() => {
  const configuredDistance = Number(env.MATCHING_DISTANCE_KM);
  return Number.isFinite(configuredDistance) && configuredDistance > 0 ? configuredDistance : 30;
})();

// Fix #4 (HIGH): Emergency requests (high/critical urgency) use a wider radius
// so more donors are reachable in time-sensitive situations.
// Override via EMERGENCY_MATCHING_DISTANCE_KM env variable (default: 60 km).
const EMERGENCY_MATCHING_DISTANCE_KM = (() => {
  const configured = Number(env.EMERGENCY_MATCHING_DISTANCE_KM);
  return Number.isFinite(configured) && configured > 0 ? configured : 60;
})();

const ACTIVE_REQUEST_STATUSES = ['pending', 'in-progress'];
const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed'];
const EVALUATE_BATCH_SIZE = 50;

const isGeoIndexError = (error) =>
  error.name === 'MongoServerError' &&
  /(\$geoNear|\$near|2dsphere|GEONEAR|geo index|index for.*geo)/i.test(error.message);

const fetchRequestsWithGeoFallback = async ({ geoQueryBuilder, fallbackQuery, logMeta }) => {
  try {
    return await geoQueryBuilder.exec();
  } catch (error) {
    if (!isGeoIndexError(error)) throw error;
    logger.warn('Geospatial $near query failed; falling back to plain request query', {
      error: error.message,
      ...logMeta,
    });
    return await fallbackQuery.exec();
  }
};

const getRequestLocationPoint = (request) => geoUtil.extractLocation(request, 'request');

const getDonorLocationPoint = (donor) => geoUtil.extractLocation(donor, 'donor');

const buildRequestGeoQuery = (location, radiusKm = DEFAULT_MATCHING_DISTANCE_KM) => {
  const geoPoint = geoUtil.extractGeoPoint(location);
  const normalizedRadiusKm = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : DEFAULT_MATCHING_DISTANCE_KM;

  if (!geoPoint) {
    return { geoQuery: null, radiusKm: normalizedRadiusKm };
  }

  return {
    radiusKm: normalizedRadiusKm,
    geoQuery: {
      hospitalLocationGeo: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [geoPoint.longitude, geoPoint.latitude],
          },
          $maxDistance: normalizedRadiusKm * 1000,
        },
      },
    },
  };
};

const buildRequestQuery = ({ bloodType = null, type = null, urgency = null, isEmergency = null } = {}) => {
  const query = {
    status: { $in: ACTIVE_REQUEST_STATUSES },
  };

  if (bloodType) query.bloodType = bloodType;
  if (type) query.type = type;
  if (urgency) query.urgency = urgency;
  if (isEmergency === true) query.isEmergency = true;

  return query;
};

const isRequestMatchable = (request) => {
  if (!request) return false;
  if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) return false;

  if (request.status === 'pending' && request.requiredBy) {
    const requiredBy = new Date(request.requiredBy);
    if (!Number.isNaN(requiredBy.getTime()) && requiredBy <= new Date()) {
      return false;
    }
  }

  return request.status !== 'cancelled' && request.status !== 'completed' && request.status !== 'expired';
};

const extractRequestLocation = (request) => geoUtil.extractLocation(request, 'request');

const extractDonorLocation = (donor) => geoUtil.extractLocation(donor, 'donor');

export const evaluateMatch = async (donor, request, options = {}) => {
  const { radiusKm = DEFAULT_MATCHING_DISTANCE_KM, allowOptedOut = false } = options;
  if (!donor || !request) {
    return { matched: false, reason: ELIGIBILITY_KEYS.DONOR_OR_REQUEST_NOT_FOUND };
  }

  if (!allowOptedOut && donor.isOptedIn === false) {
    return { matched: false, reason: ELIGIBILITY_KEYS.DONOR_OPTED_OUT_OF_MATCHING };
  }

  const eligibility = await checkEligibility(donor, request, options);
  if (!eligibility.eligible) {
    return { matched: false, reason: eligibility.reason };
  }

  const requestBloodTypes = normalizeBloodTypeList(request.bloodType);
  if (requestBloodTypes.length > 0 && !isBloodTypeCompatible(donor.bloodType, requestBloodTypes)) {
    return {
      matched: false,
      reason: ELIGIBILITY_KEYS.BLOOD_TYPE_INCOMPATIBLE,
    };
  }

  const donorLocation = extractDonorLocation(donor);
  const requestLocation = extractRequestLocation(request);
  if (!donorLocation || !requestLocation) {
    return { matched: false, reason: ELIGIBILITY_KEYS.MATCHING_LOCATION_UNAVAILABLE };
  }

  const distanceKm = geoUtil.calculateDistance(
    { latitude: donorLocation.latitude, longitude: donorLocation.longitude },
    { latitude: requestLocation.latitude, longitude: requestLocation.longitude },
  );

  if (!Number.isFinite(distanceKm) || distanceKm > radiusKm) {
    return {
      matched: false,
      reason: ELIGIBILITY_KEYS.OUTSIDE_MATCHING_RADIUS,
      distanceKm: Number.isFinite(distanceKm) ? Math.round(distanceKm * 100) / 100 : null,
    };
  }

  return {
    matched: true,
    distanceKm: Math.round(distanceKm * 100) / 100,
    locationScore: geoUtil.getLocationScore(distanceKm, radiusKm),
    eligibility: eligibility.reason,
  };
};

/**
 * Calculate geo-based location score using Haversine distance.
 * Returns 0-100 where 100 = same location, 0 = beyond maxDistance km.
 */
const calculateLocationScore = (donorLocation, hospitalLocation) => {
  const donorCoords = donorLocation?.coordinates;
  const hospitalCoords = hospitalLocation?.coordinates;

  if (!donorCoords?.lat || !donorCoords?.lng || !hospitalCoords?.lat || !hospitalCoords?.lng) {
    // Fall back to governorate matching if no coordinates
    if (donorLocation?.governorate && hospitalLocation?.governorate) {
      return donorLocation.governorate === hospitalLocation.governorate ? 70 : 30;
    }
    return 50; // No location data — neutral score
  }

  const distance = geoUtil.calculateDistance(
    { latitude: donorCoords.lat, longitude: donorCoords.lng },
    { latitude: hospitalCoords.lat, longitude: hospitalCoords.lng },
  );

  return geoUtil.getLocationScore(distance, DEFAULT_MATCHING_DISTANCE_KM);
};

/**
 * Check if donor's blood type is compatible with request
 * @param {string} donorBloodType - Donor's blood type
 * @param {string} requestBloodType - Required blood type for request
 * @returns {boolean} - True if compatible
 */
export const isBloodTypeCompatible = (donorBloodType, requestBloodType) => {
  return isBloodTypeCompatibleWithAnyRequestType(donorBloodType, requestBloodType);
};

/**
 * Check if donor is eligible to donate
 * - Blood type compatible
 * - Available
 * - Sufficient time since last donation (type-specific cooldowns)
 * @param {Object} donor - Donor document
 * @param {Object} request - Request document
 * @returns {Object} - {eligible: boolean, reason: string}
 */
export const checkEligibility = async (donor, request, options = {}) => {
  // 1. Donor account active
  if (!donor || donor.deletedAt) {
    return { eligible: false, reason: 'Donor account is deleted or inactive' };
  }
  if (donor.role && donor.role !== 'donor') {
    return { eligible: false, reason: 'Invalid donor role' };
  }

  // 2. Not suspended
  if (donor.isSuspended) {
    return { eligible: false, reason: 'Donor account is suspended' };
  }

  // 3. Donor availability status (only if matching / displaying / accepting requests)
  if (!options.allowOptedOut && donor.isOptedIn === false) {
    return { eligible: false, reason: ELIGIBILITY_KEYS.DONOR_OPTED_OUT_OF_MATCHING };
  }

  // 4. Any existing medical restrictions
  if (donor.healthHistory?.chronicConditions && donor.healthHistory.chronicConditions.length > 0) {
    return { eligible: false, reason: 'Donor has chronic medical conditions' };
  }

  // 5. Blood type compatibility
  if (!donor.bloodType) {
    return { eligible: false, reason: ELIGIBILITY_KEYS.DONOR_HAS_NO_BLOOD_TYPE };
  }
  const requestBloodTypes = normalizeBloodTypeList(request?.bloodType);
  if (requestBloodTypes.length > 0 && !isBloodTypeCompatible(donor.bloodType, requestBloodTypes)) {
    return {
      eligible: false,
      reason: ELIGIBILITY_KEYS.BLOOD_TYPE_INCOMPATIBLE,
    };
  }

  // 6. Eligibility rules & Cooldown period completed & Not deferred
  const donorEligibility = await canDonate(donor, {
    persistTravelDeferral: false,
    donationType: request?.type || 'blood',
    ...options
  });
  if (!donorEligibility.eligible) {
    return donorEligibility;
  }

  // 7. Within request radius/distance limits
  const donorLocation = extractDonorLocation(donor);
  const requestLocation = extractRequestLocation(request);
  if (donorLocation && requestLocation) {
    const distanceKm = geoUtil.calculateDistance(donorLocation, requestLocation);
    const maxDist = ['high', 'critical'].includes(request.urgency)
      ? EMERGENCY_MATCHING_DISTANCE_KM
      : DEFAULT_MATCHING_DISTANCE_KM;
    const radiusKm = request.escalationLevel === 3 ? maxDist * 2.0 : maxDist;
    if (!Number.isFinite(distanceKm) || distanceKm > radiusKm) {
      return { eligible: false, reason: ELIGIBILITY_KEYS.OUTSIDE_MATCHING_RADIUS };
    }
  }

  // 8. Donor has not already rejected or completed this request
  if (request?._id && !options.isAppointment) {
    const hasPriorDonation = await Donation.exists({
      donorId: donor._id,
      requestId: request._id,
      status: { $in: ['completed', 'rejected', 'expired'] }
    });
    if (hasPriorDonation) {
      return { eligible: false, reason: 'Donor has already completed or rejected this request' };
    }
  }

  return { eligible: true, reason: ELIGIBILITY_KEYS.DONOR_ELIGIBLE };
};

/**
 * Find all compatible donors for a specific request
 * @param {string} requestId - Request ID
 * @returns {Array} - Array of compatible donors sorted by score
 */
export const findCompatibleDonors = async (requestId) => {
  const request = await Request.findById(requestId).populate('hospitalId', 'location');
  if (!request) {
    throw new Error(ELIGIBILITY_KEYS.REQUEST_NOT_FOUND);
  }

  // Fix #4 (HIGH): Use a wider matching radius for high/critical urgency requests
  // so more donors are reachable in time-sensitive situations.
  let radiusKm = ['high', 'critical'].includes(request.urgency)
    ? EMERGENCY_MATCHING_DISTANCE_KM
    : DEFAULT_MATCHING_DISTANCE_KM;

  // Expand radius if escalationLevel is 3 (Attempt 3: Expanded donor pool)
  if (request.escalationLevel === 3) {
    radiusKm = radiusKm * 2.0;
  }

  // Pre-filter by participation preference + blood type at DB level.
  // Medical eligibility and hard distance filtering are evaluated dynamically below.
  const donorQuery = { isOptedIn: true, isSuspended: { $ne: true } };
  const requestBloodTypes = normalizeBloodTypeList(request.bloodType);
  if (requestBloodTypes.length > 0) {
    donorQuery.bloodType = { $in: getCompatibleDonorTypesForRequest(requestBloodTypes) };
  }

  // Pre-filter using geospatial $nearSphere if feature flag is active
  const hospitalLocation = request.hospitalId?.location;
  const hospitalCoords = hospitalLocation?.coordinates;
  const hasHospitalCoords = hospitalCoords && Number.isFinite(hospitalCoords.lat) && Number.isFinite(hospitalCoords.lng);

  if (process.env.ENABLE_GEOSPATIAL_INDEX === 'true' && hasHospitalCoords) {
    donorQuery['location.coordinates'] = {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [Number(hospitalCoords.lat), Number(hospitalCoords.lng)],
        },
        $maxDistance: radiusKm * 1000,
      },
    };
  }

  let donors;
  try {
    donors = await Donor.find(donorQuery).limit(500);
  } catch (error) {
    if (isGeoIndexError(error)) {
      logger.warn('Donor $nearSphere query failed; falling back to plain query', {
        error: error.message,
        requestId: String(requestId),
      });
      const fallbackQuery = { isOptedIn: true, isSuspended: { $ne: true } };
      if (requestBloodTypes.length > 0) {
        fallbackQuery.bloodType = { $in: getCompatibleDonorTypesForRequest(requestBloodTypes) };
      }
      donors = await Donor.find(fallbackQuery).limit(500);
    } else {
      throw error;
    }
  }

  // Batch check existing donations (eliminates N+1 queries)
  const donorIds = donors.map((d) => d._id);
  const [existingDonations, activeDonations] = await Promise.all([
    Donation.find({
      donorId: { $in: donorIds },
      requestId,
      status: { $in: ['completed', 'rejected', 'expired'] },
    }).select('donorId'),
    Donation.find({
      donorId: { $in: donorIds },
      status: { $in: ['pending', 'scheduled'] },
    }).select('donorId'),
  ]);

  const respondedDonorIds = new Set(existingDonations.map((d) => d.donorId.toString()));
  const activeDonationDonorIds = new Set(activeDonations.map((d) => d.donorId.toString()));

  const compatibleDonors = [];

  const eligibleDonors = donors.filter(donor =>
    !respondedDonorIds.has(donor._id.toString()) &&
    !activeDonationDonorIds.has(donor._id.toString())
  );

  for (let i = 0; i < eligibleDonors.length; i += EVALUATE_BATCH_SIZE) {
    const batch = eligibleDonors.slice(i, i + EVALUATE_BATCH_SIZE);
    const matchResults = await Promise.all(
      batch.map(donor => evaluateMatch(donor, request, { radiusKm }))
    );

    for (let j = 0; j < batch.length; j++) {
      const donor = batch[j];
      const match = matchResults[j];
      if (!match.matched) continue;

      // Calculate compatibility score (0-100 scale)
      let score = 100;

      // Bonus for exact blood type match
      if (requestBloodTypes.includes(donor.bloodType)) {
        score += 20;
      }

      // Geo-based location scoring using Haversine distance
      const locationScore = calculateLocationScore(donor.location, hospitalLocation);
      score = (score + locationScore) / 2;

      compatibleDonors.push({
        donor,
        score: Math.round(score * 10) / 10,
        locationScore,
        eligibility: match.eligibility,
        distanceKm: match.distanceKm,
      });
    }
  }

  return compatibleDonors.sort((a, b) => b.score - a.score);
};

export const searchCompatibleDonors = async ({
  bloodType = null,
  location = null,
  radiusKm = 5,
  participation = true,
} = {}) => {
  const donorQuery = { isSuspended: { $ne: true } };

  if (typeof participation === 'boolean') {
    // Map the public 'participation' param to the canonical isOptedIn field.
    donorQuery.isOptedIn = participation;
  }

  const normalizedSearchBloodTypes = normalizeBloodTypeList(bloodType);
  if (normalizedSearchBloodTypes.length > 0) {
    donorQuery.bloodType = { $in: getCompatibleDonorTypesForRequest(normalizedSearchBloodTypes) };
  }

  const normalizedRadiusKm = Number.isFinite(radiusKm) ? radiusKm : DEFAULT_MATCHING_DISTANCE_KM;
  const geoPoint = geoUtil.extractGeoPoint(location);
  const searchHasLocation = Boolean(geoPoint);

  if (process.env.ENABLE_GEOSPATIAL_INDEX === 'true' && searchHasLocation) {
    donorQuery['location.coordinates'] = {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [Number(geoPoint.latitude), Number(geoPoint.longitude)],
        },
        $maxDistance: normalizedRadiusKm * 1000,
      },
    };
  }

  let donors;
  try {
    donors = await Donor.find(donorQuery).limit(500);
  } catch (error) {
    if (isGeoIndexError(error)) {
      logger.warn('Donor $nearSphere search query failed; falling back to plain query', {
        error: error.message,
      });
      const { 'location.coordinates': _removed, ...plainQuery } = donorQuery;
      donors = await Donor.find(plainQuery).limit(500);
    } else {
      throw error;
    }
  }
  const activeDonations = await Donation.find({
    donorId: { $in: donors.map((donor) => donor._id) },
    status: { $in: ['pending', 'scheduled'] },
  }).select('donorId');
  const activeDonationDonorIds = new Set(activeDonations.map((donation) => donation.donorId.toString()));

  const searchRequest = normalizedSearchBloodTypes.length > 0 ? { type: 'blood', bloodType: normalizedSearchBloodTypes } : { type: 'search' };
  const compatibleDonors = [];

  const eligibleDonors = donors.filter(donor => !activeDonationDonorIds.has(donor._id.toString()));

  for (let i = 0; i < eligibleDonors.length; i += EVALUATE_BATCH_SIZE) {
    const batch = eligibleDonors.slice(i, i + EVALUATE_BATCH_SIZE);

    const matchResults = searchHasLocation
      ? await Promise.all(batch.map(donor =>
          evaluateMatch(donor, {
            ...searchRequest,
            hospitalLocationGeo: { type: 'Point', coordinates: [geoPoint.longitude, geoPoint.latitude] },
          }, { radiusKm: normalizedRadiusKm, allowOptedOut: participation === false })
        ))
      : await Promise.all(batch.map(donor =>
          checkEligibility(donor, searchRequest)
        ));

    for (let j = 0; j < batch.length; j++) {
      const donor = batch[j];
      const result = matchResults[j];

      let distanceKm = null;
      let locationScore = 50;
      let eligibilityReason = ELIGIBILITY_KEYS.DONOR_ELIGIBLE;

      if (searchHasLocation) {
        const match = result;
        if (!match.matched) continue;
        distanceKm = match.distanceKm;
        locationScore = match.locationScore;
        eligibilityReason = match.eligibility;
      } else {
        const eligibility = result;
        if (!eligibility.eligible) continue;
        eligibilityReason = eligibility.reason;
      }

      let score = 100;
      if (normalizedSearchBloodTypes.includes(donor.bloodType)) {
        score += 20;
      }
      score = (score + locationScore) / 2;

      compatibleDonors.push({
        donor,
        score: Math.round(score * 10) / 10,
        locationScore,
        eligibility: eligibilityReason,
        distanceKm: distanceKm === null ? null : Math.round(distanceKm * 100) / 100,
      });
    }
  }

  return compatibleDonors.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return b.score - a.score;
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return b.score - a.score;
  });
};

/**
 * Find all compatible requests for a specific donor
 * @param {string} donorId - Donor ID
 * @returns {Array} - Array of compatible requests
 */
export const findNearbyRequests = async ({
  location = null,
  radiusKm = DEFAULT_MATCHING_DISTANCE_KM,
  filters = {},
  limit = 500,
} = {}) => {
  const { geoQuery, radiusKm: normalizedRadiusKm } = buildRequestGeoQuery(location, radiusKm);
  const baseQuery = Request.find(buildRequestQuery(filters)).sort({ urgency: -1, createdAt: -1 });
  const geoQueryBuilder = geoQuery
    ? Request.find({ ...buildRequestQuery(filters), ...geoQuery })
    : baseQuery;

  const requests = await fetchRequestsWithGeoFallback({
    geoQueryBuilder: geoQueryBuilder.populate(
      'hospitalId',
      'fullName hospitalName address phone location'
    ).limit(limit),
    fallbackQuery: baseQuery.populate(
      'hospitalId',
      'fullName hospitalName address phone location'
    ).limit(limit),
    logMeta: { location, radiusKm },
  });

  return requests
    .filter((request) => isRequestMatchable(request))
    .map((request) => ({
      request,
      radiusKm: normalizedRadiusKm,
      location: getRequestLocationPoint(request),
    }));
};

export const findCompatibleRequests = async (
  donorId,
  {
    radiusKm = DEFAULT_MATCHING_DISTANCE_KM,
    filters = {},
    limit = 500,
    excludeActiveDonationInProgress = true,
    excludeActiveAppointments = true,
  } = {},
) => {
  const donor = await Donor.findById(donorId);
  if (!donor) {
    throw new Error(ELIGIBILITY_KEYS.DONOR_NOT_FOUND);
  }

  if (donor.isOptedIn === false) {
    return [];
  }

  if (donor.isSuspended) {
    return [];
  }

  // Two-layer defense: this global donation guard blocks donors already in a
  // pending/scheduled lifecycle, while the appointment query below catches
  // any active booking state that is not represented by a donation document.
  if (excludeActiveDonationInProgress && await hasActiveDonationInProgress(donor)) {
    return [];
  }

  const donorLocation = getDonorLocationPoint(donor);
  const maxQueryRadius = Math.max(radiusKm, EMERGENCY_MATCHING_DISTANCE_KM);
  const { geoQuery, radiusKm: normalizedRadiusKm } = buildRequestGeoQuery(donorLocation, maxQueryRadius);
  const baseQuery = Request.find(buildRequestQuery(filters)).sort({ urgency: -1, createdAt: -1 });
  const requestQuery = geoQuery
    ? Request.find({ ...buildRequestQuery(filters), ...geoQuery })
    : baseQuery;

  // Get all active requests with hospital location for geo-scoring.
  // If the 2dsphere index is missing or geo data is malformed, fall back to a
  // plain query; the in-memory evaluateMatch loop still enforces the radius.
  const requests = await fetchRequestsWithGeoFallback({
    geoQueryBuilder: requestQuery.populate('hospitalId', 'address location').limit(limit),
    fallbackQuery: baseQuery.populate('hospitalId', 'address location').limit(limit),
    logMeta: { donorId, radiusKm },
  });

  // Batch check existing donations (eliminates N+1 queries)
  const requestIds = requests.map((r) => r._id);
  const [existingDonations, activeAppointments] = await Promise.all([
    Donation.find({
      donorId,
      requestId: { $in: requestIds },
      status: { $in: ['completed', 'rejected'] },
    }).select('requestId'),
    Appointment.find({
      donorId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }).select('requestId'),
  ]);

  if (excludeActiveAppointments && activeAppointments.length > 0) {
    return [];
  }

  const respondedRequestIds = new Set(existingDonations.map((d) => d.requestId.toString()));

  const compatibleRequests = [];

  const eligibleRequests = requests.filter(r => !respondedRequestIds.has(r._id.toString()));

  const BATCH_SIZE = EVALUATE_BATCH_SIZE;
  for (let i = 0; i < eligibleRequests.length; i += BATCH_SIZE) {
    const batch = eligibleRequests.slice(i, i + BATCH_SIZE);

    const maxDists = batch.map(r =>
      ['high', 'critical'].includes(r.urgency)
        ? EMERGENCY_MATCHING_DISTANCE_KM
        : radiusKm
    );

    const matchResults = await Promise.all(
      batch.map((request, idx) => evaluateMatch(donor, request, { radiusKm: maxDists[idx] }))
    );

    for (let j = 0; j < batch.length; j++) {
      const request = batch[j];
      const match = matchResults[j];
      if (!match.matched) continue;

      const requestBloodTypes = normalizeBloodTypeList(request.bloodType);

      // Calculate compatibility score
      let score = 100;

      // Blood type match bonus
      if (requestBloodTypes.includes(donor.bloodType)) {
        score += 20;
      }

      // Urgency factor (critical requests get priority)
      const urgencyBonus = { critical: 25, high: 15, medium: 5, low: 0 };
      score += urgencyBonus[request.urgency] || 0;

      // Geo-based location scoring using Haversine distance
      const locationScore = calculateLocationScore(donor.location, request.hospitalId?.location);
      score = (score + locationScore) / 2;

      compatibleRequests.push({
        request,
        score: Math.round(score * 10) / 10,
        locationScore,
        compatibility: {
          bloodTypeMatch: isBloodTypeCompatible(donor.bloodType, request.bloodType),
          eligible: true,
          distanceKm: match.distanceKm,
        },
      });
    }
  }

  return compatibleRequests.sort((a, b) => b.score - a.score);
};

/**
 * Get detailed matching analysis
 * @param {string} donorId - Donor ID
 * @param {string} requestId - Request ID
 * @returns {Object} - Detailed matching information
 */
export const getMatchingAnalysis = async (donorId, requestId) => {
  try {
    const donor = await Donor.findById(donorId);
    const request = await Request.findById(requestId);

    if (!donor || !request) {
      throw new Error(ELIGIBILITY_KEYS.DONOR_OR_REQUEST_NOT_FOUND);
    }

    const eligibility = await checkEligibility(donor, request);

    return {
      donor: {
        id: donor._id,
        name: donor.name,
        bloodType: donor.bloodType,
        isOptedIn: donor.isOptedIn ?? true,
        lastDonationDate: donor.lastDonationDate,
      },
      request: {
        id: request._id,
        type: request.type,
        bloodType: normalizeBloodTypeList(request.bloodType),
        organType: request.organType,
        urgency: request.urgency,
      },
      compatibility: {
        bloodTypeMatch: normalizeBloodTypeList(request.bloodType).length > 0 ? isBloodTypeCompatible(donor.bloodType, request.bloodType) : null,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
      },
    };
  } catch (error) {
    throw error;
  }
};

export {
  DEFAULT_MATCHING_DISTANCE_KM,
  EMERGENCY_MATCHING_DISTANCE_KM,
  extractDonorLocation,
  extractRequestLocation,
};
