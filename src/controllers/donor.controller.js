import crypto from 'crypto';
import response from '../utils/response.js';
import mongoose from 'mongoose';
import Donor from '../models/Donor.model.js';
import User from '../models/User.model.js';
import Appointment from '../models/Appointment.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import * as matchingService from '../services/matching.service.js';
import * as donationService from '../services/donation.service.js';
import * as notificationService from '../services/notification.service.js';
import * as activityService from '../services/activity.service.js';
import * as eligibilityService from '../services/eligibility.service.js';
import NotificationOutbox from '../models/NotificationOutbox.model.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import * as rewardService from '../services/reward.service.js';
import { formatActivityForTimeline } from '../utils/activity.formatter.js';
import { buildRequestPayload, buildDonorRequestSummary } from './request.controller.js';
import { formatBloodTypeLabel, normalizeBloodTypeList } from '../utils/blood-type.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { validateOrphanState, validateTransition } from '../utils/state-machine.js';
import { URGENCY_TIMEOUTS } from '../constants/request-timeout.constants.js';

const DONATION_QR_TTL_MS = 2 * 60 * 60 * 1000;

const createDonationQrPayload = () => {
  const now = new Date();
  return {
    qrToken: crypto.randomBytes(32).toString('hex'),
    qrExpires: new Date(now.getTime() + DONATION_QR_TTL_MS),
  };
};

/**
 * Donor Controller - Handles donor-specific operations
 */

// Get donor profile
export const getProfile = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const [donor, donationStats, pointsSummary, badges] = await Promise.all([
      Donor.findById(donorId).select(
        '-password -__v -createdAt -updatedAt -fullNameNormalized ' +
        '-emailVerifiedAt -isSuspended -suspendedAt -suspendedReason -deletedAt ' +
        '-fcmTokens -travelHistory -hemoglobinLevel -isBanned -isVerified -isOptedIn ' +
        '-lastDonationDate -__t -location.lastUpdated'
      ),
      donationService.getDonorStats(donorId),
      rewardService.getPointsSummary(donorId),
      rewardService.getDonorBadges(donorId),
    ]);
    if (!donor) return response.error(res, 404, 'Donor profile not found');

    // Compute age from dateOfBirth
    const age = donor.dateOfBirth
      ? Math.floor((Date.now() - new Date(donor.dateOfBirth)) / (365.25 * 24 * 3600 * 1000))
      : null;

    const unlocked = badges.badges.filter(b => b.unlockStatus === 'UNLOCKED');
    const locked = badges.badges.filter(b => b.unlockStatus !== 'UNLOCKED');
    const currentBadge = unlocked.at(-1)?.badgeName || null;
    const nextBadge = locked[0]?.badgeName || null;
    const progressPercentage = locked[0]
      ? Math.round((locked[0].progressCurrent / locked[0].progressTarget) * 100)
      : 100;

    const stats = {
      totalDonations: donationStats?.totalDonations || 0,
      points: pointsSummary?.pointsBalance || 0,
      livesSaved: (donationStats?.totalDonations || 0) * 3,
    };

    const badgeProgress = { currentBadge, nextBadge, progressPercentage };

    const donorObj = donor.toObject ? donor.toObject() : { ...donor };

    response.success(res, 200, 'Donor profile retrieved successfully', {
      ...donorObj,
      verificationStatus: donor.isEmailVerified ? 'verified' : 'unverified',
      age,
      weight: donor.weight ?? null,
      stats,
      badgeProgress,
    });
  } catch (error) {
    next(error);
  }
};

// Update donor profile
export const updateProfile = async (req, res, next) => {
  try {
    const { fullName, phoneNumber, gender, location, weight, email, bloodType, dateOfBirth } = req.body;

    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    if (fullName) donor.fullName = fullName;
    if (phoneNumber) {
      const phoneRegex = /^[0-9]{11}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return response.error(res, 400, 'Phone number must be 11 digits long');
      }
      donor.phoneNumber = phoneNumber;
    }
    if (gender && ['male', 'female'].includes(gender)) {
      donor.gender = gender;
    }
    if (location) {
      donor.location = location;
    }
    if (weight !== undefined) {
      donor.weight = weight;
    }
    if (bloodType) {
      donor.bloodType = bloodType;
    }
    if (dateOfBirth) {
      donor.dateOfBirth = dateOfBirth;
    }

    const updateFieldsList = [];
    if (fullName) updateFieldsList.push('fullName');
    if (phoneNumber) updateFieldsList.push('phoneNumber');
    if (gender && ['male', 'female'].includes(gender)) updateFieldsList.push('gender');
    if (location) updateFieldsList.push('location');
    if (weight !== undefined) updateFieldsList.push('weight');
    if (bloodType) updateFieldsList.push('bloodType');
    if (dateOfBirth) updateFieldsList.push('dateOfBirth');

    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      // Check if email is already used by another user
      const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user.userId } });
      if (existingUser) {
        return response.error(res, 400, 'Email is already in use by another account');
      }
      
      if (donor.email !== normalizedEmail) {
        donor.email = normalizedEmail;
        donor.isEmailVerified = false;
        updateFieldsList.push('email');
      }
    }

    await donor.save();

    // Log profile update activity (fire-and-forget)
    activityService.logActivity(req.user.userId, {
      type: 'profile_update',
      action: 'updated_profile',
      title: 'Profile Updated',
      description: `Updated profile fields: ${updateFieldsList.join(', ')}`,
      referenceId: req.user.userId,
      referenceType: 'User',
      metadata: {
        updatedFields: updateFieldsList,
        updateCount: updateFieldsList.length,
        updatedAt: new Date()
      }
    }).catch((error) => {
      console.error('Activity log error:', error.message);
    });

    const donorObj = donor.toObject();
    delete donorObj.password;

    response.success(res, 200, 'Donor profile updated successfully', donorObj);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

// Get matched requests for this donor — supports ?page=1&limit=10
// Get matching requests for this donor — supports ?page=1&limit=10
// NOTE: This endpoint duplicates functionality with GET /donor/matches
// TODO: Consolidate these two endpoints in future refactor
export const getRequests = async (req, res, next) => {
  try {
    const { offset, limit, page } = parsePagination(req.query);

    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    if (donor.isOptedIn === false) {
      return response.success(res, 200, 'Requests retrieved successfully', {
        requests: [],
        pagination: paginationMeta(0, page, limit),
      });
    }

    // Fix #5 (HIGH): Donors without a location cannot be matched to any
    // request. Return a clear 422 with LOCATION_REQUIRED so the mobile
    // app can route the donor to the location-update screen.
    const donorCoords = donor?.location?.coordinates;
    const hasLocation = donorCoords && (
      (Number.isFinite(donorCoords.lat) && Number.isFinite(donorCoords.lng)) ||
      (Number.isFinite(donorCoords.latitude) && Number.isFinite(donorCoords.longitude))
    );
    if (!hasLocation) {
      return response.error(res, 422, 'Please set your location to see blood requests.', {
        code: 'LOCATION_REQUIRED',
      });
    }

    // Fix #6 (HIGH): active appointment guard returns a structured reason
    // instead of a bare empty array so the UI can show a helpful message.
    const activeAppointments = await Appointment.find({
      donorId: donor._id,
      status: { $in: ['pending', 'confirmed'] },
    });
    if (activeAppointments.length > 0) {
      return response.success(res, 200, 'Requests retrieved successfully', {
        requests: [],
        pagination: paginationMeta(0, page, limit),
        reason: 'ACTIVE_APPOINTMENT_EXISTS',
        message: 'You have an active appointment. Complete or cancel it to see new requests.',
      });
    }

    const matchedRequests = await matchingService.findCompatibleRequests(donor._id);
    const paginatedRequests = matchedRequests.slice(offset, offset + limit).map(({ request, score, locationScore, compatibility }) => ({
      ...buildDonorRequestSummary(request),
      score,
      locationScore,
      compatibility,
    }));

    response.success(res, 200, 'Requests retrieved successfully', {
      requests: paginatedRequests,
      pagination: paginationMeta(matchedRequests.length, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

// Get matching requests for this donor — supports ?page=1&limit=10
// NOTE: This endpoint duplicates functionality with GET /donor/requests
// Kept for backward compatibility - consider using /requests instead
// TODO: Consolidate these two endpoints in future refactor
export const getMatches = async (req, res, next) => {
  try {
    const { offset, limit, page } = parsePagination(req.query);
    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    if (donor.isOptedIn === false) {
      return response.success(res, 200, 'Matching requests retrieved successfully', {
        matches: [],
        pagination: paginationMeta(0, page, limit),
      });
    }

    // Fix #5 (HIGH): Enforce location before running match query
    const donorCoords = donor?.location?.coordinates;
    const hasLocation = donorCoords && (
      (Number.isFinite(donorCoords.lat) && Number.isFinite(donorCoords.lng)) ||
      (Number.isFinite(donorCoords.latitude) && Number.isFinite(donorCoords.longitude))
    );
    if (!hasLocation) {
      return response.error(res, 422, 'Please set your location to see blood requests.', {
        code: 'LOCATION_REQUIRED',
      });
    }

    // Fix #6 (HIGH): surface reason when active appointment blocks results
    const activeAppointmentsMatches = await Appointment.find({
      donorId: donor._id,
      status: { $in: ['pending', 'confirmed'] },
    });
    if (activeAppointmentsMatches.length > 0) {
      return response.success(res, 200, 'Matching requests retrieved successfully', {
        matches: [],
        pagination: paginationMeta(0, page, limit),
        reason: 'ACTIVE_APPOINTMENT_EXISTS',
        message: 'You have an active appointment. Complete or cancel it to see new requests.',
      });
    }

    const matches = await matchingService.findCompatibleRequests(donor._id);
    const paginatedMatches = matches.slice(offset, offset + limit).map((match) => ({
      ...match,
      request: buildDonorRequestSummary(match.request),
    }));

    response.success(res, 200, 'Matching requests retrieved successfully', {
      matches: paginatedMatches,
      pagination: paginationMeta(matches.length, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

// Respond to a request (create a donation)
export const respondToRequest = async (req, res, next) => {
  const { requestId } = req.params;
  const { quantity } = req.body;
  const donorId = req.user.userId;

  try {
    const donor = await Donor.findById(donorId);
    if (!donor) return response.error(res, 404, 'Donor not found');

    const session = await mongoose.startSession();
    let createdDonation = null;
    try {
      await session.withTransaction(async () => {
        // Re-fetch request in-session
        const request = await Request.findById(requestId).session(session);
        if (!request) {
          const err = new Error('Request not found');
          err.statusCode = 404;
          throw err;
        }

        if (request.status !== 'pending') {
          const err = new Error('This request is no longer accepting responses');
          err.statusCode = 400;
          throw err;
        }

        try {
          validateTransition('request', request.status, 'accepted');
        } catch (err) {
          err.statusCode = 400;
          throw err;
        }

        // Check if donor already responded (in-session)
        const existingDonation = await Donation.findOne({
          donorId,
          requestId,
          status: { $nin: ['cancelled', 'rejected'] },
        }).session(session);

        if (existingDonation) {
          const err = new Error('You have already responded to this request');
          err.statusCode = 400;
          throw err;
        }

        // Validate eligibility
        const isEligible = await donationService.validateEligibility(donor, request);
        if (!isEligible.eligible) {
          const err = new Error(isEligible.reason || ELIGIBILITY_KEYS.DONOR_NOT_ELIGIBLE);
          err.statusCode = 400;
          throw err;
        }

        // Create donation in-session and issue a donation QR for donor confirmation.
        const urgencyKey = request.isEmergency ? 'emergency' : (request.urgency || 'medium');
        const timeouts = URGENCY_TIMEOUTS[urgencyKey] || URGENCY_TIMEOUTS.medium;
        const arrivalWindowMs = timeouts.arrivalWindowMs;
        const now = new Date();
        const qrExpires = new Date(now.getTime() + arrivalWindowMs);
        const qrToken = crypto.randomBytes(32).toString('hex');

        const [donation] = await Donation.create([
          {
            donorId,
            requestId,
            quantity: quantity || 1,
            status: 'pending',
            qrToken,
            qrExpires,
            arrivalDeadline: qrExpires,
          },
        ], { session });
        createdDonation = donation;

        // Atomically update request only if still pending
        const updatedRequest = await Request.findOneAndUpdate(
          { _id: requestId, status: 'pending' },
          {
            $set: {
              status: 'accepted',
              acceptedBy: donorId,
              acceptedByName: donor.fullName || null,
              acceptedByPhoneNumber: donor.phoneNumber || null,
              acceptedByBloodType: donor.bloodType || null,
              acceptedAt: new Date(),
              acceptedDonationId: donation._id,
            },
          },
          { session, returnDocument: 'after' },
        );

        if (!updatedRequest) {
          const err = new Error('Request was accepted by another donor');
          err.statusCode = 409;
          throw err;
        }

        // Validate orphan state inside transaction
        validateOrphanState('request', updatedRequest, { donation });

        // Create NotificationOutbox entry for match notifications
        await NotificationOutbox.create([
          {
            requestId: updatedRequest._id,
            userId: updatedRequest.hospitalId,
            donorIds: [donorId],
            type: 'match',
            status: 'pending',
          },
        ], { session });
      });
    } finally {
      session.endSession();
    }

    // Log activity after successful commit (fire-and-forget)
    const requestObj = await Request.findById(requestId).lean();
    const isUrgent = ['high', 'critical'].includes(requestObj?.urgency);
    const activityPayload = isUrgent
      ? {
          type: 'emergency_response',
          action: 'ACCEPT_REQUEST',
          title: 'Urgent Request Accepted',
          description: `Accepted urgent ${requestObj.type} request with ${requestObj.urgency} urgency`,
          referenceId: createdDonation._id.toString(),
          referenceType: 'Donation',
          metadata: {
            requestType: requestObj.type,
            urgency: requestObj.urgency,
            quantity: quantity || 1,
            requestId,
            acceptedAt: new Date(),
          },
        }
      : {
          type: 'donation',
          action: 'accepted_request',
          title: 'Request Accepted',
          description: `Accepted ${requestObj?.type} request`,
          referenceId: createdDonation._id.toString(),
          referenceType: 'Donation',
          metadata: {
            requestType: requestObj?.type,
            urgency: requestObj?.urgency || 'normal',
            quantity: quantity || 1,
            requestId,
            acceptedAt: new Date(),
          },
        };

    activityService.logActivity(donorId, activityPayload).catch((error) => {
      console.error('Activity log error:', error.message);
    });

    // Response (donation created)
    response.success(res, 201, 'Response submitted successfully', createdDonation);
  } catch (error) {
    if (error.name === 'ValidationError') return response.error(res, 400, error.message);
    if (error.statusCode === 404) return response.error(res, 404, error.message);
    if (error.statusCode === 400) return response.error(res, 400, error.message);
    if (error.statusCode === 409) return response.error(res, 409, error.message);
    next(error);
  }
};

// Get donation history — supports ?page=1&limit=10
export const getDonationHistory = async (req, res, next) => {
  try {
    const { status } = req.query;
    const { offset, limit, page } = parsePagination(req.query);

    const filter = { donorId: new mongoose.Types.ObjectId(req.user.userId) };
    if (status && ['pending', 'scheduled', 'completed', 'cancelled', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const [donationsWithPoints, total] = await Promise.all([
      Donation.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: offset }, { $limit: limit },
        { $lookup: {
          from: 'pointstransactions',
          let: { donId: { $toString: '$_id' } },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$referenceId', { $concat: ['donation_', '$$donId'] }] },
              { $eq: ['$transactionType', 'BLOOD_DONATION'] },
            ]}}},
            { $project: { pointsAmount: 1 } },
          ],
          as: 'pointsTx',
        }},
        { $addFields: { pointsEarned: { $ifNull: [{ $arrayElemAt: ['$pointsTx.pointsAmount', 0] }, 0] } }},
        { $project: { pointsTx: 0, __v: 0 } },
      ]),
      Donation.countDocuments(filter),
    ]);

    const donations = await Donation.populate(donationsWithPoints, {
      path: 'requestId',
      select: 'type bloodType organType urgency hospitalId',
      populate: { path: 'hospitalId', select: 'fullName hospitalName address' },
    });

    response.success(res, 200, 'Donation history retrieved successfully', {
      donations,
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

// Update participation preference (donor opts in/out of matching)
export const updateParticipation = async (req, res, next) => {
  try {
    // Accept new field names ('isOptedIn', 'participation') OR legacy 'isAvailable' for backward compat
    let rawValue = req.body.isOptedIn;
    if (rawValue === undefined) {
      rawValue = req.body.participation;
    }
    if (rawValue === undefined) {
      rawValue = req.body.isAvailable;
    }

    if (typeof rawValue !== 'boolean') {
      const errorMsg = req.t ? req.t('error_invalid_participation') : 'isOptedIn must be a boolean value';
      return response.error(res, 400, errorMsg);
    }

    const donor = await Donor.findByIdAndUpdate(
      req.user.userId,
      { isOptedIn: rawValue },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    const successMsg = req.t ? req.t('participation_updated') : 'Participation preference updated successfully';
    response.success(res, 200, successMsg, donor);
  } catch (error) {
    next(error);
  }
};

// Check donation eligibility for a specific request
export const getDonationEligibility = async (req, res, next) => {
  try {
    // Reject any attempt to specify another donor's id
    if (req.params?.donorId || req.query?.donorId || req.body?.donorId) {
      return response.error(res, 400, 'Specifying donorId is not allowed');
    }

    // Determine authenticated donor id (support either field used by JWT middleware)
    const donorId = req.user?.userId ?? req.user?.id ?? req.user?._id;
    if (!donorId) return response.error(res, 500, 'Authenticated donor id not found');

    // Load donor profile (readonly)
    const donor = await Donor.findById(donorId).select('isOptedIn lastDonationDate bloodType gender hemoglobinLevel temporaryDeferralUntil travelHistory dateOfBirth');
    if (!donor) return response.error(res, 404, 'Donor not found');

    // Do not accept request-specific parameters for this informational endpoint
    if (req.query?.requestId || req.query?.donationType) {
      return response.error(res, 400, 'requestId and donationType are not accepted on this endpoint');
    }

    // Build a generic eligibility request using donor's default context (Health Profile uses current donor info)
    const eligibilityRequest = { type: 'blood', bloodType: donor.bloodType || null };

    // Use the same validation used by matching, booking, rescheduling and donation flows
    const eligibility = await donationService.validateEligibility(donor, eligibilityRequest);

    // Compute UI-friendly fields (donationType not exposed — eligibility is donor-centric)
    const cooldownDays = eligibilityService.getCooldownDays(donor);
    const nextEligibleDate = eligibility.nextEligibleDate ? new Date(eligibility.nextEligibleDate) : eligibilityService.computeNextEligibleDate(donor);
    const now = new Date();
    const daysRemaining = nextEligibleDate ? Math.max(0, Math.ceil((new Date(nextEligibleDate) - now) / (1000 * 60 * 60 * 24))) : 0;

    const reason = eligibility.eligible ? null : (
      eligibility.nextEligibleDate || nextEligibleDate
        ? (req.t ? req.t('eligibility.donationCooldownActive') : 'eligibility.donationCooldownActive')
        : (req.t ? req.t(eligibility.reason || 'eligibility.donorNotEligible') : (eligibility.reason || 'eligibility.donorNotEligible'))
    );

    const payload = {
      isEligible: !!eligibility.eligible,
      reason,
      nextEligibleDate: nextEligibleDate ? new Date(nextEligibleDate).toISOString() : null,
      participationEnabled: donor.isOptedIn ?? true,
      lastDonationDate: donor.lastDonationDate ? new Date(donor.lastDonationDate).toISOString() : null,
      cooldownDays,
      daysRemaining,
    };

    return response.success(res, 200, 'Eligibility result', payload);
  } catch (error) {
    next(error);
  }
};

// Health history handlers removed (endpoint deleted)
 
export const getDashboard = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    
    // Fetch all dashboard data in parallel
    const [donor, appointment, donationStats, pointsSummary, badges, latestActivity] = await Promise.all([
      Donor.findById(donorId).select('fullName bloodType lastDonationDate suspensionStatus'),
      Appointment.findOne({ donorId, status: { $in: ['pending', 'confirmed'] } }).sort({ appointmentDate: -1 }),
      donationService.getDonorStats(donorId),
      rewardService.getPointsSummary(donorId),
      rewardService.getDonorBadges(donorId),
      activityService.getLatestActivities(donorId, 5),
    ]);

    // Compute donation status
    let donationStatus = 'eligible';
    if (appointment) {
      donationStatus = 'pending';
    } else if (donor?.suspensionStatus === 'suspended') {
      donationStatus = 'notEligible';
    } else if (donor?.lastDonationDate) {
      const daysSinceLastDonation = Math.floor(
        (new Date() - donor.lastDonationDate) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastDonation < 56) {
        donationStatus = 'notEligible';
      }
    }

    const displayName = donor?.fullName || 'Donor';
    const firstName = displayName.split(' ')[0] || displayName;

    return response.success(res, 200, 'Donor dashboard retrieved successfully', {
      userInfo: {
        firstName,
        fullName: displayName,
        bloodType: donor?.bloodType || 'Unknown',
        donationStatus,
      },
      stats: {
        totalDonations: donationStats?.totalDonations || 0,
        points: pointsSummary?.pointsBalance ?? 0,
        livesSaved: (donationStats?.totalDonations || 0) * 3,
      },
      recentActivity: (latestActivity || []).map((activity) => formatActivityForTimeline(activity)),
      badges: badges || [],
    });
  } catch (err) { next(err); }
};

export const getRecentActivity = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const [donations, points] = await Promise.all([
      donationService.getDonationHistory(donorId, { page, limit }),
      rewardService.getPointsHistory(donorId, { page, limit }),
    ]);

    return response.success(res, 200, 'Recent activity retrieved successfully', {
      donations,
      points,
    });
  } catch (err) { next(err); }
};

/**
 * DEPRECATED & REMOVED (Phase 7 - API Consolidation)
 * 
 * The following functions were removed as part of the API consolidation refactor:
 * - getUrgentRequests() - Use GET /requests/nearby?urgency=critical instead
 * - getUrgentRequestDetails() - Use GET /requests/{id} instead  
 * - declineUrgentRequest() - Simply don't respond to requests
 * 
 * Urgent requests are now integrated into the main request endpoints.
 * Keep these implementations commented for reference during migration period.
 */

/*
export const getUrgentRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, lat, lng } = req.query;
    const offset = (page - 1) * limit;
    const donorId = req.user.userId;

    const donor = await Donor.findById(donorId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    if (donor.isOptedIn === false) {
      return response.success(res, 200, 'Urgent requests retrieved', {
        requests: [],
        pagination: { total: 0, page: parseInt(page), limit: parseInt(limit) },
      });
    }

    // Exclude requests this donor already declined (cancelled donations)
    const declinedRequestIds = await Donation.distinct('requestId', {
      donorId,
      status: 'cancelled',
      requestId: { $ne: null },
    });

    const matchedRequests = await matchingService.findCompatibleRequests(donor._id);
    const urgentMatches = matchedRequests
      .filter(({ request }) => ['high', 'critical'].includes(request.urgency))
      .filter(({ request }) => !declinedRequestIds.some((id) => id.toString() === request._id.toString()));

    const paginatedMatches = urgentMatches.slice(offset, offset + parseInt(limit));
    const requests = paginatedMatches.map(({ request }) => request);
    const total = urgentMatches.length;

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const mapped = requests.map(r => {
      const hospital = r.hospitalId;
      const hLat = hospital?.lat;
      const hLng = hospital?.long;
      const bloodTypes = normalizeBloodTypeList(r.bloodType);
      const bloodTypeLabel = formatBloodTypeLabel(bloodTypes);
      let distance = null;
      if (Number.isFinite(userLat) && Number.isFinite(userLng) && hLat && hLng) {
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(hLat - userLat), dLng = toRad(hLng - userLng);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(userLat))*Math.cos(toRad(hLat))*Math.sin(dLng/2)**2;
        distance = parseFloat((2 * 6371 * Math.asin(Math.sqrt(a))).toFixed(2));
      }
      return {
        id: r._id,
        title: `Urgent ${String(r.type || 'request').replace(/^./, (char) => char.toUpperCase())} Request — ${bloodTypeLabel || ''}`.trim(),
        bloodType: bloodTypes,
        bloodTypeLabel,
        unitsNeeded: r.quantity || 1,
        hospitalName: hospital?.hospitalName || hospital?.fullName || null,
        distance,
        isEmergency: r.urgency === 'critical',
        patientType: r.type || 'blood',
        contactNumber: hospital?.contactNumber || null,
        createdAt: r.createdAt,
        location: (hLat && hLng) ? { lat: hLat, lng: hLng } : null,
      };
    });

    return response.success(res, 200, 'Urgent requests retrieved', {
      requests: mapped,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) { next(err); }
};

export const getUrgentRequestDetails = async (req, res, next) => {
  try {
    const request = await Request.findOne({
      _id: req.params.requestId,
      urgency: { $in: ['high', 'critical'] },
      status: { $in: ['pending', 'in-progress'] },
    }).populate('hospitalId', 'fullName hospitalName address contactNumber lat long');

    if (!request) {
      return response.error(res, 404, 'Urgent request not found');
    }

    const hospital = request.hospitalId;

    return response.success(res, 200, 'Urgent request retrieved successfully', {
      request: {
        id: request._id,
        title: `Urgent ${String(request.type || 'request').replace(/^./, (char) => char.toUpperCase())} Request — ${formatBloodTypeLabel(request.bloodType) || ''}`.trim(),
        bloodType: normalizeBloodTypeList(request.bloodType),
        bloodTypeLabel: formatBloodTypeLabel(request.bloodType),
        unitsNeeded: request.quantity || 1,
        hospitalName: hospital?.hospitalName || hospital?.fullName || null,
        contactNumber: hospital?.contactNumber || null,
        isEmergency: request.urgency === 'critical',
        patientType: request.type || 'blood',
        createdAt: request.createdAt,
        location: Number.isFinite(hospital?.lat) && Number.isFinite(hospital?.long)
          ? { lat: hospital.lat, lng: hospital.long }
          : null,
      },
    });
  } catch (err) { next(err); }
};

export const declineUrgentRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const request = await Request.findOne({
      _id: requestId,
      urgency: { $in: ['high', 'critical'] },
      status: { $in: ['pending', 'in-progress'] },
    });

    if (!request) {
      return response.error(res, 404, 'Urgent request not found');
    }

    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    const existingResponse = await Donation.findOne({
      donorId: req.user.userId,
      requestId,
    });

    if (existingResponse && existingResponse.status !== 'cancelled') {
      return response.error(res, 400, 'You have already responded to this request');
    }

    if (existingResponse && existingResponse.status === 'cancelled') {
      return response.success(res, 200, 'Urgent request already declined', existingResponse);
    }

    const declinedResponse = await Donation.create({
      donorId: req.user.userId,
      requestId,
      quantity: request.quantity || 1,
      status: 'cancelled',
      notes: reason ? `Declined urgent request: ${reason}` : 'Declined urgent request',
    });

    // Log urgent request decline activity (fire-and-forget)
    activityService.logActivity(req.user.userId, {
      type: 'emergency_response',
      action: 'DECLINE_REQUEST',
      title: 'Urgent Request Declined',
      description: `Declined urgent ${request.type} request with ${request.urgency} urgency${reason ? `: ${reason}` : ''}`,
*/
// Function implementations removed - see above
//     const { requestId } = req.params;
//     const { reason } = req.body;

//     const request = await Request.findOne({
//       _id: requestId,
//       urgency: { $in: ['high', 'critical'] },
//       status: { $in: ['pending', 'in-progress'] },
//     });

//     if (!request) {
//       return response.error(res, 404, 'Urgent request not found');
//     }

//     const donor = await Donor.findById(req.user.userId);
//     if (!donor) {
//       return response.error(res, 404, 'Donor not found');
//     }

//     const existingResponse = await Donation.findOne({
//       donorId: req.user.userId,
//       requestId,
//     });

//     if (existingResponse && existingResponse.status !== 'cancelled') {
//       return response.error(res, 400, 'You have already responded to this request');
//     }

//     if (existingResponse && existingResponse.status === 'cancelled') {
//       return response.success(res, 200, 'Urgent request already declined', existingResponse);
//     }

//     const declinedResponse = await Donation.create({
//       donorId: req.user.userId,
//       requestId,
//       quantity: request.quantity || 1,
//       status: 'cancelled',
//       notes: reason ? `Declined urgent request: ${reason}` : 'Declined urgent request',
//     });

//     // Log urgent request decline activity (fire-and-forget)
//     activityService.logActivity(req.user.userId, {
//       type: 'emergency_response',
//       action: 'DECLINE_REQUEST',
//       title: 'Urgent Request Declined',
//       description: `Declined urgent ${request.type} request with ${request.urgency} urgency${reason ? `: ${reason}` : ''}`,
//       referenceId: declinedResponse._id.toString(),
//       referenceType: 'Donation',
//       metadata: {
//         requestType: request.type,
//         urgency: request.urgency,
//         declineReason: reason || 'Not specified',
//         requestId: requestId,
//         declinedAt: new Date()
//       }
//     }).catch((error) => {
//       console.error('Activity log error:', error.message);
//     });

//     return response.success(res, 201, 'Urgent request declined successfully', declinedResponse);
//   } catch (err) { next(err); }
// };

// ─── Donor Settings (Dev 1 Task 5) ─────────────────────────────────────────
export const getSettings = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const donor = await Donor.findById(donorId).select('settings');

    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    return response.success(res, 200, 'Donor settings retrieved successfully', {
      settings: donor.settings || {
        pushNotifications: true,
        emergencyAlerts: true,
        privacyMode: false,
        language: 'en',
      },
    });
  } catch (err) { 
    next(err); 
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const { pushNotifications, emergencyAlerts, privacyMode, language } = req.body;

    // Validate language enum
    if (language && !['en', 'ar'].includes(language)) {
      return response.error(res, 400, 'Language must be "en" or "ar"');
    }

    // Build update object
    const updateData = {};
    if (pushNotifications !== undefined) updateData['settings.pushNotifications'] = pushNotifications;
    if (emergencyAlerts !== undefined) updateData['settings.emergencyAlerts'] = emergencyAlerts;
    if (privacyMode !== undefined) updateData['settings.privacyMode'] = privacyMode;
    if (language !== undefined) updateData['settings.language'] = language;

    const updatedDonor = await Donor.findByIdAndUpdate(
      donorId,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).select('settings');

    if (!updatedDonor) {
      return response.error(res, 404, 'Donor not found');
    }

    return response.success(res, 200, 'Donor settings updated successfully', {
      settings: updatedDonor.settings,
    });
  } catch (err) { next(err); }
};

export const getDonorStats = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const [donationStats, pointsSummary] = await Promise.all([
      donationService.getDonorStats(donorId),
      rewardService.getPointsSummary(donorId),
    ]);
    response.success(res, 200, 'Donor stats retrieved', {
      totalDonations: donationStats?.totalDonations || 0,
      points: pointsSummary?.pointsBalance || 0,
      livesSaved: (donationStats?.totalDonations || 0) * 3,
    });
  } catch (err) { next(err); }
};

export const getDonorRewards = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const [pointsSummary, badges] = await Promise.all([
      rewardService.getPointsSummary(donorId),
      rewardService.getDonorBadges(donorId),
    ]);
    const earned = badges.badges.filter(b => b.unlockStatus === 'UNLOCKED');
    const locked = badges.badges.filter(b => b.unlockStatus !== 'UNLOCKED');
    response.success(res, 200, 'Donor rewards retrieved', {
      currentPoints: pointsSummary.pointsBalance,
      earnedBadges: earned.map(b => ({ id: b.badgeId, title: b.badgeName, description: b.badgeDescription })),
      lockedBadges: locked.map(b => ({ id: b.badgeId, title: b.badgeName, progress: b.progressCurrent, target: b.progressTarget })),
      nextMilestone: pointsSummary.pointsToNextTier,
    });
  } catch (err) { next(err); }
};
