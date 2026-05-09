import response from '../utils/response.js';
import Donor from '../models/Donor.model.js';
import Appointment from '../models/Appointment.model.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import * as matchingService from '../services/matching.service.js';
import * as donationService from '../services/donation.service.js';
import * as notificationService from '../services/notification.service.js';
import * as activityService from '../services/activity.service.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import * as rewardService from '../services/reward.service.js';

/**
 * Donor Controller - Handles donor-specific operations
 */

// Get donor profile
export const getProfile = async (req, res, next) => {
  try {
    const donorId = req.user.userId;
    const [donor, donationStats, pointsSummary, badges] = await Promise.all([
      Donor.findById(donorId).select('-password'),
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

    response.success(res, 200, 'Donor profile retrieved successfully', {
      ...donor.toObject(),
      verificationStatus: donor.isEmailVerified ? 'verified' : 'unverified',
      age,
      weight: donor.weight ?? null,
      stats,
      currentBadge,
      nextBadge,
      progressPercentage,
      badgeProgress,
    });
  } catch (error) {
    next(error);
  }
};

// Update donor profile
export const updateProfile = async (req, res, next) => {
  try {
    const { fullName, phoneNumber, gender, location, weight } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phoneNumber) {
      const phoneRegex = /^[0-9]{11}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return response.error(res, 400, 'Phone number must be 11 digits long');
      }
      updateData.phoneNumber = phoneNumber;
    }
    if (gender && ['male', 'female'].includes(gender)) {
      updateData.gender = gender;
    }
    if (location) {
      updateData.location = location;
    }
    if (weight !== undefined) {
      updateData.weight = weight;
    }

    const donor = await Donor.findByIdAndUpdate(req.user.userId, updateData, {
      returnDocument: 'after',
      runValidators: true,
    }).select('-password');

    // Log profile update activity (fire-and-forget)
    const updatedFields = Object.keys(updateData).join(', ');
    activityService.logActivity(req.user.userId, {
      type: 'profile_update',
      action: 'updated_profile',
      title: 'Profile Updated',
      description: `Updated profile fields: ${updatedFields}`,
      referenceId: req.user.userId,
      referenceType: 'Donor',
      metadata: {
        updatedFields: Object.keys(updateData),
        updateCount: Object.keys(updateData).length,
        updatedAt: new Date()
      }
    }).catch((error) => {
      console.error('Activity log error:', error.message);
    });

    response.success(res, 200, 'Donor profile updated successfully', donor);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

// Get all active requests — supports ?page=1&limit=10 or legacy ?skip=0&limit=10
export const getRequests = async (req, res, next) => {
  try {
    const { type, urgency } = req.query;
    const { skip, limit, page } = parsePagination(req.query);

    const filter = {
      status: { $in: ['pending', 'in-progress'] },
    };

    if (type && ['blood', 'organ'].includes(type)) {
      filter.type = type;
    }
    if (urgency && ['low', 'medium', 'high', 'critical'].includes(urgency)) {
      filter.urgency = urgency;
    }

    const [requests, total] = await Promise.all([
      Request.find(filter)
        .populate('hospitalId', 'fullName hospitalName address contactNumber')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
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

// Get matching requests for this donor — supports ?page=1&limit=10 or legacy ?skip=0&limit=10
export const getMatches = async (req, res, next) => {
  try {
    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    const { skip, limit, page } = parsePagination(req.query);

    const matches = await matchingService.findCompatibleRequests(donor._id);
    const paginatedMatches = matches.slice(skip, skip + limit);

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
  try {
    const { requestId } = req.params;
    const { quantity } = req.body;

    const request = await Request.findById(requestId);
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    // Check if donor already responded
    const existingDonation = await Donation.findOne({
      donorId: req.user.userId,
      requestId,
      status: { $ne: 'cancelled' },
    });

    if (existingDonation) {
      return response.error(res, 400, 'You have already responded to this request');
    }

    // Validate eligibility
    const isEligible = await donationService.validateEligibility(donor, request);
    if (!isEligible.eligible) {
        return response.error(res, 400, isEligible.reason || 'Donor is not eligible');
    }

    // Create donation
    const donation = await Donation.create({
      donorId: req.user.userId,
      requestId,
      quantity: quantity || 1,
      status: 'pending',
    });

    // Decrement quantity and auto-close if 0
    const updatedRequest = await Request.findByIdAndUpdate(
      requestId,
      { $inc: { quantity: -1 } },
      { returnDocument: 'after' }
    );
    if (updatedRequest && updatedRequest.quantity <= 0) {
      await Request.findByIdAndUpdate(requestId, { status: 'completed' });
    }

    // Log activity based on request urgency (fire-and-forget)
    const isUrgent = ['high', 'critical'].includes(request.urgency);
    const activityPayload = isUrgent ? {
      type: 'emergency_response',
      action: 'ACCEPT_REQUEST',
      title: 'Urgent Request Accepted',
      description: `Accepted urgent ${request.type} request with ${request.urgency} urgency`,
      referenceId: donation._id.toString(),
      referenceType: 'Donation',
      metadata: {
        requestType: request.type,
        urgency: request.urgency,
        quantity: quantity || 1,
        requestId: requestId,
        acceptedAt: new Date()
      }
    } : {
      type: 'donation',
      action: 'accepted_request',
      title: 'Request Accepted',
      description: `Accepted ${request.type} request`,
      referenceId: donation._id.toString(),
      referenceType: 'Donation',
      metadata: {
        requestType: request.type,
        urgency: request.urgency || 'normal',
        quantity: quantity || 1,
        requestId: requestId,
        acceptedAt: new Date()
      }
    };
    
    activityService.logActivity(req.user.userId, activityPayload).catch((error) => {
      console.error('Activity log error:', error.message);
    });

    // Notify hospital
    await notificationService.notifyMatch(request.hospitalId, donation, request);

    response.success(res, 201, 'Response submitted successfully', donation);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

// Get donation history — supports ?page=1&limit=10 or legacy ?skip=0&limit=10
export const getDonationHistory = async (req, res, next) => {
  try {
    const { status } = req.query;
    const { skip, limit, page } = parsePagination(req.query);

    const filter = { donorId: req.user.userId };
    if (status && ['pending', 'scheduled', 'completed', 'cancelled', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const [donationsWithPoints, total] = await Promise.all([
      Donation.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip }, { $limit: limit },
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
        { $project: { pointsTx: 0 } },
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

// Update availability status
export const updateAvailability = async (req, res, next) => {
  try {
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return response.error(res, 400, 'isAvailable must be a boolean value');
    }

    const donor = await Donor.findByIdAndUpdate(
      req.user.userId,
      { isAvailable },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    response.success(res, 200, 'Availability status updated successfully', donor);
  } catch (error) {
    next(error);
  }
};

// Check donation eligibility for a specific request
export const getDonationEligibility = async (req, res, next) => {
  try {
    const { requestId } = req.query;
    if (!requestId) {
      return response.error(res, 400, 'requestId is required');
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    const eligibility = await donationService.validateEligibility(donor, request);
    return response.success(res, 200, 'Eligibility result', eligibility);
  } catch (error) {
    next(error);
  }
};

const normalizeStringList = (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  return normalized;
};

const normalizeHealthHistoryPayload = (body) => {
  const payload = {};

  const chronicConditions = normalizeStringList(body.chronicConditions);
  if (chronicConditions === null) return { error: 'chronicConditions must be an array of strings' };
  if (chronicConditions !== undefined) payload.chronicConditions = chronicConditions;

  const medications = normalizeStringList(body.medications);
  if (medications === null) return { error: 'medications must be an array of strings' };
  if (medications !== undefined) payload.medications = medications;

  const allergies = normalizeStringList(body.allergies);
  if (allergies === null) return { error: 'allergies must be an array of strings' };
  if (allergies !== undefined) payload.allergies = allergies;

  if (body.recentIllness !== undefined) {
    if (typeof body.recentIllness !== 'string') return { error: 'recentIllness must be a string' };
    payload.recentIllness = body.recentIllness.trim();
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') return { error: 'notes must be a string' };
    payload.notes = body.notes.trim();
  }

  if (body.lastCheckupDate !== undefined) {
    const checkupDate = new Date(body.lastCheckupDate);
    if (Number.isNaN(checkupDate.getTime())) return { error: 'lastCheckupDate must be a valid date' };
    if (checkupDate > new Date()) return { error: 'lastCheckupDate must be in the past' };
    payload.lastCheckupDate = checkupDate;
  }

  return { payload };
};

export const getHealthHistory = async (req, res, next) => {
  try {
    const donor = await Donor.findById(req.user.userId).select('healthHistory');
    if (!donor) {
      return response.error(res, 404, 'Donor profile not found');
    }

    return response.success(res, 200, 'Health history retrieved successfully', {
      healthHistory: donor.healthHistory || {
        chronicConditions: [],
        medications: [],
        allergies: [],
        recentIllness: '',
        notes: '',
        lastCheckupDate: null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateHealthHistory = async (req, res, next) => {
  try {
    const normalized = normalizeHealthHistoryPayload(req.body || {});
    if (normalized.error) {
      return response.error(res, 400, normalized.error);
    }

    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor profile not found');
    }

    donor.healthHistory = {
      ...(donor.healthHistory || {}),
      ...normalized.payload,
      updatedAt: new Date(),
    };

    await donor.save({ validateBeforeSave: true });

    // Log health history update activity (fire-and-forget)
    const updatedHistoryFields = Object.keys(normalized.payload);
    activityService.logActivity(req.user.userId, {
      type: 'profile_update',
      action: 'updated_health_history',
      title: 'Health History Updated',
      description: `Updated health history fields: ${updatedHistoryFields.join(', ')}`,
      referenceId: req.user.userId,
      referenceType: 'HealthHistory',
      metadata: {
        updatedFields: updatedHistoryFields,
        updateCount: updatedHistoryFields.length,
        hasChronicConditions: !!normalized.payload.chronicConditions,
        hasMedications: !!normalized.payload.medications,
        hasAllergies: !!normalized.payload.allergies,
        updatedAt: new Date()
      }
    }).catch((error) => {
      console.error('Activity log error:', error.message);
    });

    return response.success(res, 200, 'Health history updated successfully', {
      healthHistory: donor.healthHistory,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};

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
        points: pointsSummary?.pointsBalance || pointsSummary?.totalPoints || 0,
        livesSaved: (donationStats?.totalDonations || 0) * 3,
      },
      recentActivity: (latestActivity || []).map((activity) => ({
        id: activity._id,
        type: activity.type,
        title: activity.title,
        subTitle: activity.description,
        points: activity.metadata?.pointsAmount || 0,
        createdAt: activity.createdAt,
      })),
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

export const getUrgentRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, lat, lng } = req.query;
    const skip = (page - 1) * limit;
    const donorId = req.user.userId;

    // Exclude requests this donor already declined (cancelled donations)
    const declinedRequestIds = await Donation.distinct('requestId', {
      donorId,
      status: 'cancelled',
      requestId: { $ne: null },
    });

    const filter = {
      status: { $in: ['pending', 'in-progress'] },
      urgency: { $in: ['high', 'critical'] },
      ...(declinedRequestIds.length > 0 ? { _id: { $nin: declinedRequestIds } } : {}),
    };

    const [requests, total] = await Promise.all([
      Request.find(filter)
        .populate('hospitalId', 'fullName hospitalName contactNumber lat long')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Request.countDocuments(filter),
    ]);

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const mapped = requests.map(r => {
      const hospital = r.hospitalId;
      const hLat = hospital?.lat;
      const hLng = hospital?.long;
      let distance = null;
      if (Number.isFinite(userLat) && Number.isFinite(userLng) && hLat && hLng) {
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(hLat - userLat), dLng = toRad(hLng - userLng);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(userLat))*Math.cos(toRad(hLat))*Math.sin(dLng/2)**2;
        distance = parseFloat((2 * 6371 * Math.asin(Math.sqrt(a))).toFixed(2));
      }
      return {
        id: r._id,
        title: `Urgent ${r.type === 'blood' ? 'Blood' : 'Organ'} Request — ${r.bloodType || r.organType || ''}`.trim(),
        bloodType: r.bloodType || null,
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
        title: `Urgent ${request.type === 'blood' ? 'Blood' : 'Organ'} Request — ${request.bloodType || request.organType || ''}`.trim(),
        bloodType: request.bloodType || null,
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
      referenceId: declinedResponse._id.toString(),
      referenceType: 'Donation',
      metadata: {
        requestType: request.type,
        urgency: request.urgency,
        declineReason: reason || 'Not specified',
        requestId: requestId,
        declinedAt: new Date()
      }
    }).catch((error) => {
      console.error('Activity log error:', error.message);
    });

    return response.success(res, 201, 'Urgent request declined successfully', declinedResponse);
  } catch (err) { next(err); }
};

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
  } catch (err) { next(err); }
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
