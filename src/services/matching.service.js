import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import { env } from '../config/env.js';
import * as geoUtil from '../utils/geo.js';
import { canDonate } from './eligibility.service.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
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

const extractRequestLocation = (request) => {
  const hospital = request?.hospitalId || {};
  const hospitalLocation = hospital.location || {};

  const latitude = request?.locationHospital?.latitude
    ?? request?.hospitalLocation?.lat
    ?? request?.hospitalLocationGeo?.coordinates?.[1]
    ?? hospitalLocation.coordinates?.lat
    ?? hospital.lat
    ?? null;
  const longitude = request?.locationHospital?.longitude
    ?? request?.hospitalLocation?.lng
    ?? request?.hospitalLocationGeo?.coordinates?.[0]
    ?? hospitalLocation.coordinates?.lng
    ?? hospital.long
    ?? null;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const extractDonorLocation = (donor) => {
  const coordinates = donor?.location?.coordinates || {};
  const latitude = coordinates.lat ?? donor?.location?.latitude ?? donor?.location?.lat ?? null;
  const longitude = coordinates.lng ?? donor?.location?.longitude ?? donor?.location?.long ?? null;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

export const evaluateMatch = async (donor, request, { radiusKm = DEFAULT_MATCHING_DISTANCE_KM, allowOptedOut = false } = {}) => {
  if (!donor || !request) {
    return { matched: false, reason: ELIGIBILITY_KEYS.DONOR_OR_REQUEST_NOT_FOUND };
  }

  if (!allowOptedOut && donor.isOptedIn === false) {
    return { matched: false, reason: ELIGIBILITY_KEYS.DONOR_OPTED_OUT_OF_MATCHING };
  }

  const eligibility = await checkEligibility(donor, request);
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

const hasCoordinates = (location) => {
  const coords = location?.coordinates;
  return Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng);
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
export const checkEligibility = async (donor, request) => {
  const donorEligibility = await canDonate(donor, { persistTravelDeferral: false, donationType: request?.type });
  if (!donorEligibility.eligible) {
    return donorEligibility;
  }

  if (!donor.bloodType) {
    return { eligible: false, reason: ELIGIBILITY_KEYS.DONOR_HAS_NO_BLOOD_TYPE };
  }

  if (normalizeBloodTypeList(request?.bloodType).length > 0 && !isBloodTypeCompatible(donor.bloodType, request.bloodType)) {
    return {
      eligible: false,
      reason: ELIGIBILITY_KEYS.BLOOD_TYPE_INCOMPATIBLE,
    };
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

  // Pre-filter by participation preference + blood type at DB level.
  // Medical eligibility and hard distance filtering are evaluated dynamically below.
  const donorQuery = { isOptedIn: true, isSuspended: { $ne: true } };
  const requestBloodTypes = normalizeBloodTypeList(request.bloodType);
  if (requestBloodTypes.length > 0) {
    donorQuery.bloodType = { $in: getCompatibleDonorTypesForRequest(requestBloodTypes) };
  }

  const donors = await Donor.find(donorQuery).limit(500);

  // Batch check existing donations (eliminates N+1 queries)
  const donorIds = donors.map((d) => d._id);
  const existingDonations = await Donation.find({
    donorId: { $in: donorIds },
    requestId,
    status: { $ne: 'cancelled' },
  }).select('donorId');
  const respondedDonorIds = new Set(existingDonations.map((d) => d.donorId.toString()));

  const hospitalLocation = request.hospitalId?.location;
  const compatibleDonors = [];

  for (const donor of donors) {
    if (respondedDonorIds.has(donor._id.toString())) {
      continue;
    }

    const match = await evaluateMatch(donor, request);
    if (!match.matched) {
      continue;
    }

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

  const donors = await Donor.find(donorQuery).limit(500);
  const searchRequest = normalizedSearchBloodTypes.length > 0 ? { type: 'blood', bloodType: normalizedSearchBloodTypes } : { type: 'search' };
  const compatibleDonors = [];
  const normalizedRadiusKm = Number.isFinite(radiusKm) ? radiusKm : DEFAULT_MATCHING_DISTANCE_KM;
  const searchHasLocation = hasCoordinates(location);

  for (const donor of donors) {
    let distanceKm = null;
    let locationScore = 50;
    let eligibilityReason = ELIGIBILITY_KEYS.DONOR_ELIGIBLE;

    if (searchHasLocation) {
      const match = await evaluateMatch(donor, {
        ...searchRequest,
        locationHospital: { latitude: location.coordinates.lat, longitude: location.coordinates.lng },
      }, { radiusKm: normalizedRadiusKm, allowOptedOut: participation === false });

      if (!match.matched) {
        continue;
      }

      distanceKm = match.distanceKm;
      locationScore = match.locationScore;
      eligibilityReason = match.eligibility;
    } else {
      const eligibility = await checkEligibility(donor, searchRequest);
      if (!eligibility.eligible) {
        continue;
      }

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
export const findCompatibleRequests = async (donorId) => {
  const donor = await Donor.findById(donorId);
  if (!donor) {
    throw new Error(ELIGIBILITY_KEYS.DONOR_NOT_FOUND);
  }

  if (donor.isOptedIn === false) {
    return [];
  }

  // Get all active requests with hospital location for geo-scoring
  const requests = await Request.find({
    status: { $in: ['pending', 'in-progress'] },
  }).populate('hospitalId', 'address location').limit(500);

  // Batch check existing donations (eliminates N+1 queries)
  const requestIds = requests.map((r) => r._id);
  const existingDonations = await Donation.find({
    donorId,
    requestId: { $in: requestIds },
    status: { $ne: 'cancelled' },
  }).select('requestId');
  const respondedRequestIds = new Set(existingDonations.map((d) => d.requestId.toString()));

  const compatibleRequests = [];

  for (const request of requests) {
    const requestBloodTypes = normalizeBloodTypeList(request.bloodType);
    if (respondedRequestIds.has(request._id.toString())) continue;

    const match = await evaluateMatch(donor, request);
    if (!match.matched) continue;

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
  extractDonorLocation,
  extractRequestLocation,
};
