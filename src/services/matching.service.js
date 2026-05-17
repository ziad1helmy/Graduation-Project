import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import * as geoUtil from '../utils/geo.js';
import { canDonate } from './eligibility.service.js';

/**
 * Matching Service - Finds compatible donors for requests and vice versa
 */

/**
 * Blood type compatibility matrix
 * Donors with these blood types can donate to recipients with the key
 */
const BLOOD_TYPE_COMPATIBILITY = {
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'O-': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
  'A+': ['A+', 'AB+'],
  'A-': ['A+', 'A-', 'AB+', 'AB-'],
  'B+': ['B+', 'AB+'],
  'B-': ['B+', 'B-', 'AB+', 'AB-'],
  'AB+': ['AB+'],
  'AB-': ['AB+', 'AB-'],
};

/**
 * Reverse lookup: which donor blood types can donate TO a given recipient type?
 */
const getCompatibleDonorTypes = (recipientBloodType) => {
  return Object.entries(BLOOD_TYPE_COMPATIBILITY)
    .filter(([, recipients]) => recipients.includes(recipientBloodType))
    .map(([donorType]) => donorType);
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

  return geoUtil.getLocationScore(distance, 100);
};

/**
 * Check if donor's blood type is compatible with request
 * @param {string} donorBloodType - Donor's blood type
 * @param {string} requestBloodType - Required blood type for request
 * @returns {boolean} - True if compatible
 */
export const isBloodTypeCompatible = (donorBloodType, requestBloodType) => {
  if (!donorBloodType || !requestBloodType) return false;
  
  const compatibleTypes = BLOOD_TYPE_COMPATIBILITY[donorBloodType];
  return compatibleTypes && compatibleTypes.includes(requestBloodType);
};

/**
 * Check if donor is eligible to donate
 * - Blood type compatible
 * - Available
 * - Sufficient time since last donation (56 days for whole blood)
 * @param {Object} donor - Donor document
 * @param {Object} request - Request document
 * @returns {Object} - {eligible: boolean, reason: string}
 */
export const checkEligibility = async (donor, request) => {
  const donorEligibility = await canDonate(donor, { persistTravelDeferral: false, donationType: request?.type });
  if (!donorEligibility.eligible) {
    return donorEligibility;
  }

  // Check blood type compatibility for blood requests
  if (request.type === 'blood') {
    if (!donor.bloodType) {
      return { eligible: false, reason: 'Donor has not provided blood type information' };
    }

    if (!isBloodTypeCompatible(donor.bloodType, request.bloodType)) {
      return {
        eligible: false,
        reason: `Donor blood type ${donor.bloodType} is not compatible with request for ${request.bloodType}`,
      };
    }
  }

  return { eligible: true, reason: 'Donor is eligible' };
};

/**
 * Find all compatible donors for a specific request
 * @param {string} requestId - Request ID
 * @returns {Array} - Array of compatible donors sorted by score
 */
export const findCompatibleDonors = async (requestId) => {
  const request = await Request.findById(requestId).populate('hospitalId', 'location');
  if (!request) {
    throw new Error('Request not found');
  }

  // Pre-filter by blood type at DB level (reduces result set by ~87.5%)
  const donorQuery = { isAvailable: true, isSuspended: { $ne: true } };
  if (request.type === 'blood' && request.bloodType) {
    donorQuery.bloodType = { $in: getCompatibleDonorTypes(request.bloodType) };
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

    const eligibility = await checkEligibility(donor, request);
    if (!eligibility.eligible) {
      continue;
    }

    // Calculate compatibility score (0-100 scale)
    let score = 100;

    // Bonus for exact blood type match
    if (request.type === 'blood' && donor.bloodType === request.bloodType) {
      score += 20;
    }

    // Geo-based location scoring using Haversine distance
    const locationScore = calculateLocationScore(donor.location, hospitalLocation);
    score = (score + locationScore) / 2;

    compatibleDonors.push({
      donor,
      score: Math.round(score * 10) / 10,
      locationScore,
      eligibility: eligibility.reason,
    });
  }

  return compatibleDonors.sort((a, b) => b.score - a.score);
};

export const searchCompatibleDonors = async ({
  bloodType = null,
  location = null,
  radiusKm = 5,
  availability = true,
} = {}) => {
  const donorQuery = { isSuspended: { $ne: true } };

  if (typeof availability === 'boolean') {
    donorQuery.isAvailable = availability;
  }

  if (bloodType) {
    donorQuery.bloodType = { $in: getCompatibleDonorTypes(bloodType) };
  }

  const donors = await Donor.find(donorQuery).limit(500);
  const searchRequest = bloodType ? { type: 'blood', bloodType } : { type: 'search' };
  const compatibleDonors = [];
  const normalizedRadiusKm = Number.isFinite(radiusKm) ? radiusKm : 5;

  for (const donor of donors) {
    const eligibility = await checkEligibility(donor, searchRequest);
    if (!eligibility.eligible) {
      continue;
    }

    let distanceKm = null;
    let locationScore = 50;

    if (hasCoordinates(location) && hasCoordinates(donor.location)) {
      distanceKm = geoUtil.calculateDistance(
        {
          latitude: location.coordinates.lat,
          longitude: location.coordinates.lng,
        },
        {
          latitude: donor.location.coordinates.lat,
          longitude: donor.location.coordinates.lng,
        }
      );

      if (distanceKm > normalizedRadiusKm) {
        continue;
      }

      locationScore = geoUtil.getLocationScore(distanceKm, 100);
    } else if (hasCoordinates(location)) {
      continue;
    } else if (Number.isFinite(normalizedRadiusKm)) {
      // Without a valid search location, radius filtering cannot be applied consistently.
      continue;
    }

    let score = 100;
    if (bloodType && donor.bloodType === bloodType) {
      score += 20;
    }
    score = (score + locationScore) / 2;

    compatibleDonors.push({
      donor,
      score: Math.round(score * 10) / 10,
      locationScore,
      eligibility: eligibility.reason,
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
    throw new Error('Donor not found');
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
    if (respondedRequestIds.has(request._id.toString())) continue;

    const eligibility = await checkEligibility(donor, request);
    if (!eligibility.eligible) continue;

    // Calculate compatibility score
    let score = 100;

    // Blood type match bonus
    if (request.type === 'blood' && donor.bloodType === request.bloodType) {
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
        bloodTypeMatch: donor.bloodType === request.bloodType,
        eligible: true,
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
      throw new Error('Donor or Request not found');
    }

    const eligibility = await checkEligibility(donor, request);

    return {
      donor: {
        id: donor._id,
        name: donor.name,
        bloodType: donor.bloodType,
        isAvailable: donor.isAvailable,
        lastDonationDate: donor.lastDonationDate,
      },
      request: {
        id: request._id,
        type: request.type,
        bloodType: request.bloodType,
        organType: request.organType,
        urgency: request.urgency,
      },
      compatibility: {
        bloodTypeMatch: request.type === 'blood' 
          ? isBloodTypeCompatible(donor.bloodType, request.bloodType)
          : null,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
      },
    };
  } catch (error) {
    throw error;
  }
};
