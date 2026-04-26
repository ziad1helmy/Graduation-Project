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
  // Check availability
  if (!donor.isAvailable) {
    return { eligible: false, reason: 'Donor is not currently available' };
  }

  // Check blood type compatibility for blood requests
  if (request.type === 'blood') {
    if (!donor.bloodType) {
      return { eligible: false, reason: 'Donor has not provided blood type information' };
    }

    if (!isBloodTypeCompatible(donor.bloodType, request.bloodType)) {
      return { 
        eligible: false, 
        reason: `Donor blood type ${donor.bloodType} is not compatible with request for ${request.bloodType}` 
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
        };
      }
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
  try {
    const request = await Request.findById(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    // Get all available donors
    const donors = await Donor.find({ isAvailable: true });

    const compatibleDonors = [];

    for (const donor of donors) {
      // Check if donor already responded
      const existingDonation = await Donation.findOne({
        donorId: donor._id,
        requestId,
        status: { $ne: 'cancelled' },
      });

      if (existingDonation) continue;

      // Check eligibility
      const eligibility = checkEligibility(donor, request);
      if (!eligibility.eligible) continue;

      // Calculate compatibility score
      let score = 100; // Start with perfect score

      // Blood type match for blood requests
      if (request.type === 'blood' && donor.bloodType === request.bloodType) {
        score += 20; // Bonus for exact blood type match
      }

      // Location proximity (if both have location data)
      let locationScore = 50; // Default neutral score
      if (donor.location && request.hospitalId.location) {
        // Note: This assumes location has coordinates
        // In a real app, you'd convert city/governorate to coordinates
        locationScore = 50; // Placeholder for actual distance calculation
      }
      score = (score + locationScore) / 2;

      compatibleDonors.push({
        donor,
        score,
        eligibility: eligibility.reason,
      });
    }

    // Sort by score descending
    return compatibleDonors.sort((a, b) => b.score - a.score);
  } catch (error) {
    throw error;
  }
};

/**
 * Find all compatible requests for a specific donor
 * @param {string} donorId - Donor ID
 * @returns {Array} - Array of compatible requests
 */
export const findCompatibleRequests = async (donorId) => {
  try {
    const donor = await Donor.findById(donorId);
    if (!donor) {
      throw new Error('Donor not found');
    }

    // Get all active requests
    const requests = await Request.find({
      status: { $in: ['pending', 'in-progress'] },
    }).populate('hospitalId', 'address location');

    const compatibleRequests = [];

    for (const request of requests) {
      // Check if donor already responded
      const existingDonation = await Donation.findOne({
        donorId,
        requestId: request._id,
        status: { $ne: 'cancelled' },
      });

      if (existingDonation) continue;

      // Check eligibility
      const eligibility = checkEligibility(donor, request);
      if (!eligibility.eligible) continue;

      // Calculate compatibility score
      let score = 100;

      // Blood type match
      if (request.type === 'blood' && donor.bloodType === request.bloodType) {
        score += 20;
      }

      // Urgency factor (critical requests get priority)
      const urgencyBonus = {
        'critical': 25,
        'high': 15,
        'medium': 5,
        'low': 0,
      };
      score += urgencyBonus[request.urgency] || 0;

      compatibleRequests.push({
        request,
        score,
        compatibility: {
          bloodTypeMatch: donor.bloodType === request.bloodType,
          eligible: true,
        },
      });
    }

    // Sort by score descending
    return compatibleRequests.sort((a, b) => b.score - a.score);
  } catch (error) {
    throw error;
  }
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
