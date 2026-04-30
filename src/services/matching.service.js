import Donor from '../models/Donor.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import * as geoUtil from '../utils/geo.js';

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
export const checkEligibility = (donor, request) => {
  const warnings = [];

  const healthHistory = donor?.healthHistory || {};
  if (healthHistory.lastCheckupDate) {
    const lastCheckupDate = new Date(healthHistory.lastCheckupDate);
    const daysSinceCheckup = Math.floor((new Date() - lastCheckupDate) / (1000 * 60 * 60 * 24));
    if (Number.isFinite(daysSinceCheckup) && daysSinceCheckup > 365) {
      warnings.push('Last checkup date is older than 12 months');
    }
  } else {
    warnings.push('No checkup date on file');
  }

  if (Array.isArray(healthHistory.chronicConditions) && healthHistory.chronicConditions.length > 0) {
    warnings.push('Chronic conditions are recorded on the donor profile');
  }

  // Check availability
  if (!donor.isAvailable) {
    return { eligible: false, reason: 'Donor is not currently available', warnings };
  }

  // Check blood type compatibility for blood requests
  if (request.type === 'blood') {
    if (!donor.bloodType) {
      return { eligible: false, reason: 'Donor has not provided blood type information', warnings };
    }

    if (!isBloodTypeCompatible(donor.bloodType, request.bloodType)) {
      return { 
        eligible: false, 
        reason: `Donor blood type ${donor.bloodType} is not compatible with request for ${request.bloodType}`,
        warnings,
      };
    }

    // Check last donation date (56 days minimum for whole blood)
    const MIN_DAYS_BETWEEN_DONATIONS = 56;
    if (donor.lastDonationDate) {
      const lastDonationDate = new Date(donor.lastDonationDate);
      const daysSinceLastDonation = Math.floor(
        (new Date() - lastDonationDate) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastDonation < MIN_DAYS_BETWEEN_DONATIONS) {
        return {
          eligible: false,
          reason: `Must wait ${MIN_DAYS_BETWEEN_DONATIONS - daysSinceLastDonation} more days before donating again`,
          warnings,
        };
      }
    }
  }

  return { eligible: true, reason: 'Donor is eligible', warnings };
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
  const donorQuery = { isAvailable: true };
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

    const eligibility = checkEligibility(donor, request);
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

    const eligibility = checkEligibility(donor, request);
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

    const eligibility = checkEligibility(donor, request);

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
