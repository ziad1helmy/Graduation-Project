import crypto from 'crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import response from '../utils/response.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import User from '../models/User.model.js';
import Notification from '../models/Notification.model.js';
import * as donationService from '../services/donation.service.js';
import * as appointmentService from '../services/appointment.service.js';
import * as eligibilityService from '../services/eligibility.service.js';
import * as matchingService from '../services/matching.service.js';
import { rejectDonationLifecycle } from '../services/request-lifecycle.service.js';
import { calculateDistance, parseLatLng, extractLocation } from '../utils/geo.js';
import { formatDistance, formatEstimatedTime } from '../utils/format.js';
import { isValidObjectId, toLocation } from '../utils/query.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { sendToMultipleWithRetry, sendToMultiple } from '../utils/fcm.js';
import {
  validateNearbyRequestsQuery,
  validateRequestIdParam,
  validateQrBody,
} from '../validation/request.validation.js';
import {
  formatBloodTypeLabel,
  normalizeBloodTypeList,
} from '../utils/blood-type.js';
import ELIGIBILITY_KEYS from '../utils/eligibility-keys.js';
import { validateOrphanState, validateTransition } from '../utils/state-machine.js';
import { URGENCY_TIMEOUTS } from '../constants/request-timeout.constants.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const QR_TTL_MS = 2 * 60 * 60 * 1000;

const getRequestCoordinates = (request) => extractLocation(request, 'request');

const computeDistanceDetails = (viewerLocation, request) => {
  const requestLocation = getRequestCoordinates(request);
  if (!viewerLocation?.hasCoordinates || !requestLocation) {
    return {
      distanceKm: null,
      distanceMeters: null,
      distance: null,
      estimatedTime: null,
    };
  }

  const distanceKm = calculateDistance(
    { lat: viewerLocation.lat, long: viewerLocation.lng },
    { lat: requestLocation.latitude, long: requestLocation.longitude }
  );

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    distanceMeters: Math.round(distanceKm * 1000),
    distance: formatDistance(distanceKm),
    estimatedTime: formatEstimatedTime(distanceKm),
  };
};

const isDonorView = (roleOrOptions) => {
  if (typeof roleOrOptions === 'string') return roleOrOptions === 'donor';
  return roleOrOptions?.role === 'donor' || roleOrOptions?.audience === 'donor';
};

const buildRequestPagination = (total, page, limit, role) => {
  // Return full pagination metadata for all audiences (restore Flutter expectations)
  const meta = paginationMeta(total, page, limit);
  return meta;
};

export const buildRequestPayload = (request, viewerLocation = null, { responseCount = 0, donations = null, role = null } = {}) => {
  const requestLocation = getRequestCoordinates(request);
  const distance = computeDistanceDetails(viewerLocation, request);
  const hospitalName = request.hospitalName
    || request.hospitalId?.hospitalName
    || request.hospitalId?.fullName
    || null;
  const contactNumber = request.contactNumber
    || request.hospitalContact
    || request.hospitalId?.contactNumber
    || null;

  const payload = {
    id: request._id.toString(),
    requestId: request._id.toString(),
    bloodType: normalizeBloodTypeList(request.bloodType),
    bloodTypeLabel: formatBloodTypeLabel(request.bloodType),
    hospitalName,
    patientType: request.patientType || request.cause || null,
    contactNumber,
    unitsNeeded: request.unitsNeeded ?? request.quantity ?? 1,
    isEmergency: Boolean(request.isEmergency || request.urgency === 'critical'),
    createdAt: request.createdAt,
    status: request.status,
    requestStatus: request.status,
    urgency: request.urgency,
    type: request.type,
    requiredBy: request.requiredBy,
    locationHospital: requestLocation
      ? {
          latitude: requestLocation.latitude,
          longitude: requestLocation.longitude,
        }
      : null,
    location: toLocation(requestLocation),
    qrToken: request.qrToken || null,
    qrCreatedAt: request.qrCreatedAt || null,
    qrExpiresAt: request.qrExpiresAt || null,
    hospital: {
      id: request.hospitalId?._id?.toString?.() || request.hospitalId?.toString?.() || null,
      name: hospitalName,
      contactNumber,
      address: request.hospitalId?.address || null,
      latitude: requestLocation?.latitude ?? null,
      longitude: requestLocation?.longitude ?? null,
    },
    ...distance,
    ...(donations ? { donations, responseCount, donationCount: responseCount, totalResponses: responseCount } : {}),
  };

  if (isDonorView(role)) {
    // For donor view, keep location and distance fields so GET /requests/nearby
    // returns consistent runtime data for all clients. Only omit internal labels.
    const { bloodTypeLabel: _bloodTypeLabel, requestStatus: _requestStatus, ...donorPayload } = payload;
    return donorPayload;
  }

  return payload;
};

export const buildDonorRequestSummary = (request, viewerLocation = null) => {
  const distance = computeDistanceDetails(viewerLocation, request);
  const hospitalName = request.hospitalName
    || request.hospitalId?.hospitalName
    || request.hospitalId?.fullName
    || null;
  const requestLocation = getRequestCoordinates(request);
  const contactNumber = request.contactNumber
    || request.hospitalContact
    || request.hospitalId?.contactNumber
    || null;

  return {
    _id: request._id.toString(),
    id: request._id.toString(),
    requestId: request._id.toString(),
    posted: request.createdAt || null,
    patientType: request.patientType || request.cause || null,
    contactNumber,
    unitsNeeded: request.unitsNeeded ?? request.quantity ?? 1,
    hospitalName,
    hospitalLatitude: requestLocation?.latitude ?? null,
    hospitalLongitude: requestLocation?.longitude ?? null,
    type: request.type,
    bloodType: normalizeBloodTypeList(request.bloodType),
    urgency: request.urgency,
    estimatedTime: distance.estimatedTime,
  };
};

const filterNearbyRequests = (requests, viewerLocation, radiusKm = null) => {
  const mapped = requests
    .map((request) => ({ request, payload: buildRequestPayload(request, viewerLocation) }))
    .filter(({ payload }) => {
      if (radiusKm === null) return true;
      if (!Number.isFinite(payload.distanceKm)) return false;
      return payload.distanceKm <= radiusKm;
    })
    .sort((a, b) => {
      if (!Number.isFinite(a.payload.distanceKm) && !Number.isFinite(b.payload.distanceKm)) return 0;
      if (!Number.isFinite(a.payload.distanceKm)) return 1;
      if (!Number.isFinite(b.payload.distanceKm)) return -1;
      return a.payload.distanceKm - b.payload.distanceKm;
    });

  return mapped.map(({ payload }) => payload);
};

const populateRequest = (query) => {
  return query.populate('hospitalId', 'fullName hospitalName address contactNumber location');
};

const normalizeRequestIfExpired = async (request) => {
  if (!request) return request;

  const requestExpired = request.requiredBy && new Date(request.requiredBy) <= new Date();
  if (requestExpired && request.status === 'pending') {
    // CRITICAL FIX: Wrap status transition in transaction to prevent race
    // where concurrent checks both see status='pending' and race to update
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Re-fetch within transaction to get latest state
        const currentRequest = await Request.findById(request._id).session(session);
        if (!currentRequest) throw new Error('Request not found');

        // Re-check expiry and status within transaction
        const isExpired = currentRequest.requiredBy && new Date(currentRequest.requiredBy) <= new Date();
        if (isExpired && currentRequest.status === 'pending') {
          try {
            validateTransition('request', currentRequest.status, 'expired');
          } catch (err) {
            throw new Error(err.message);
          }

          currentRequest.status = 'expired';
          currentRequest.expiredAt = new Date();
          await currentRequest.save({ session });
          
          // Update the original request object with new state
          request.status = currentRequest.status;
          request.expiredAt = currentRequest.expiredAt;
        }
      });
    } finally {
      session.endSession();
    }
  }

  return request;
};

const getRequestSummary = (request, viewerLocation = null, role = null) => buildRequestPayload(request, viewerLocation, { role });

const canAccessRequest = (request, req) => {
  if (req.user.role === 'admin' || req.user.role === 'superadmin') return true;
  if (req.user.role === 'hospital') {
    return request.hospitalId?._id?.toString?.() === req.user.userId;
  }
  return false;
};

export const generateQr = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
    throw new HttpError(403, 'Unauthorized');
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request id');
  }

  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  if (!canAccessRequest(request, req)) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  if (['completed', 'cancelled'].includes(request.status)) {
    throw new HttpError(400, 'QR cannot be generated for a closed request');
  }
  if (request.status === 'expired') {
    throw new HttpError(400, 'QR cannot be generated for an expired request');
  }

  const now = new Date();
  request.qrToken = crypto.randomBytes(32).toString('hex');
  request.qrCreatedAt = now;
  request.qrExpiresAt = new Date(now.getTime() + QR_TTL_MS);

  await request.save();

  const qrImage = await QRCode.toDataURL(request.qrToken, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
  });

  return response.success(res, 200, 'QR generated successfully', {
    qrToken: request.qrToken,
    qrImage,
    qrCreatedAt: request.qrCreatedAt,
    qrExpiresAt: request.qrExpiresAt,
    requestId: request._id,
  });
});

export const verifyQr = asyncHandler(async (req, res) => {
  const validation = validateQrBody(req.body);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
    throw new HttpError(403, 'Unauthorized');
  }

  const qrToken = String(req.body.qrToken || req.body.qrCode).trim();

  // Atomic check-and-mark: find donation where qrUsed=false and set qrUsed=true + qrUsedAt
  // This prevents double-verification from concurrent QR scans (F2)
  const donation = await Donation.findOneAndUpdate(
    { qrToken, qrUsed: false },
    { $set: { qrUsed: true, qrUsedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!donation) {
    // Either token doesn't exist or was already used
    const existingDonation = await Donation.findOne({ qrToken });
    if (!existingDonation) {
      return response.success(res, 200, 'QR verification completed', {
        valid: false,
        message: 'Invalid or expired QR token',
      });
    }
    // Token exists but was already used
    return response.success(res, 200, 'QR verification completed', {
      valid: false,
      message: 'QR code has already been used',
    });
  }

  const request = await populateRequest(Request.findById(donation.requestId));
  if (!request) {
    return response.success(res, 200, 'QR verification completed', {
      valid: false,
      message: 'Invalid QR token - no associated request',
    });
  }

  const donorDoc = await Donor.findById(donation.donorId).select('fullName bloodType phoneNumber');

  await normalizeRequestIfExpired(request);

  if (!donorDoc) {
    return response.success(res, 200, 'QR verification completed', {
      valid: false,
      message: 'Donor no longer exists',
    });
  }

  const now = new Date();

  if (donation.qrExpires && now > new Date(donation.qrExpires)) {
    return response.success(res, 200, 'QR verification completed', {
      valid: false,
      message: 'QR code has expired',
    });
  }

  if (!['accepted', 'in-progress'].includes(request.status)) {
    return response.success(res, 200, 'QR verification completed', {
      valid: false,
      message: 'Request is no longer active',
    });
  }

  if (donation.status !== 'pending') {
    return response.success(res, 200, 'QR verification completed', {
      valid: false,
      message: 'Donation is no longer valid for verification',
    });
  }

  return response.success(res, 200, 'QR verified successfully', {
    valid: true,
    requestId: request._id,
    donationId: donation._id,
    hospitalName: request.hospitalName || request.hospitalId?.hospitalName || request.hospitalId?.fullName || null,
    bloodType: normalizeBloodTypeList(request.bloodType),
    bloodTypeLabel: formatBloodTypeLabel(request.bloodType),
    patientType: request.patientType || request.cause || null,
    contactNumber: request.contactNumber || request.hospitalContact || request.hospitalId?.contactNumber || null,
    unitsNeeded: request.unitsNeeded ?? request.quantity ?? 1,
    isEmergency: Boolean(request.isEmergency || request.urgency === 'critical'),
    createdAt: request.createdAt,
    requestStatus: request.status,
    donationStatus: donation.status,
    donorName: donorDoc?.fullName || null,
    donorBloodType: donorDoc?.bloodType || null,
    qrToken: donation.qrToken,
    qrExpiresAt: donation.qrExpires,
    arrivalDeadline: donation.arrivalDeadline,
  });
});

export const getRequestDetails = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request id');
  }

  const viewerLocation = parseLatLng(req.query);
  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  await normalizeRequestIfExpired(request);

  if (req.user.role === 'hospital' && request.hospitalId?._id?.toString?.() !== req.user.userId) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  const donations = req.user.role === 'hospital' || req.user.role === 'admin' || req.user.role === 'superadmin'
    ? await Donation.find({ requestId: request._id }).populate('donorId', 'fullName email phoneNumber location bloodType lastDonationDate')
    : null;

  const payload = buildRequestPayload(request, viewerLocation, {
    responseCount: donations?.length || 0,
    donations: donations || undefined,
    role: req.user?.role,
  });

  return response.success(res, 200, 'Request details retrieved successfully', payload);
});

export const getNearbyRequests = asyncHandler(async (req, res) => {
  const validation = validateNearbyRequestsQuery(req.query);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  const viewerLocation = parseLatLng(req.query);
  const radiusKm = req.query.radius === undefined || req.query.radius === '' ? undefined : Number(req.query.radius);
  const { page, limit, offset } = parsePagination(req.query, 20);

  const requestFilters = {
    bloodType: req.query.bloodType || null,
    type: req.query.type || null,
    urgency: req.query.urgency || null,
    isEmergency: req.query.isEmergency === 'true' || req.query.isEmergency === '1',
  };

  let nearbyResults = [];
  if (req.user?.role === 'donor') {
    nearbyResults = await matchingService.findCompatibleRequests(req.user.userId, {
      radiusKm,
      filters: requestFilters,
      limit: 500,
    });
  } else {
    const discoveryResults = await matchingService.findNearbyRequests({
      location: viewerLocation,
      radiusKm,
      filters: requestFilters,
      limit: 500,
    });

    nearbyResults = discoveryResults.map(({ request }) => ({ request }));
  }

  const formatted = nearbyResults.map((entry) => {
    // Always provide viewerLocation to compute distances for nearby endpoint.
    const requestPayload = buildRequestPayload(entry.request, viewerLocation, {
      role: req.user?.role,
    });

    const resPayload = {
      ...requestPayload,
      ...(entry.score !== undefined ? { score: entry.score } : {}),
      ...(entry.locationScore !== undefined ? { locationScore: entry.locationScore } : {}),
      ...(entry.compatibility ? { compatibility: entry.compatibility } : {}),
    };

    // If the matching entry provides a pre-computed distance, use it and derive
    // the related distance fields so runtime responses are consistent.
    if (entry.distanceKm !== undefined) {
      resPayload.distanceKm = entry.distanceKm;
      resPayload.distanceMeters = entry.distanceKm === null ? null : Math.round(entry.distanceKm * 1000);
      resPayload.distance = entry.distanceKm === null ? null : formatDistance(entry.distanceKm);
      resPayload.estimatedTime = entry.distanceKm === null ? null : formatEstimatedTime(entry.distanceKm);
    }

    return resPayload;
  });

  const paginated = formatted.slice(offset, offset + limit);
  const data = {
    requests: paginated,
    pagination: buildRequestPagination(formatted.length, page, limit, req.user?.role),
  };
  // Always include viewer location and the radius used for the query so runtime
  // consumers can rely on these values regardless of role.
  data.viewerLocation = viewerLocation.hasCoordinates
    ? { latitude: viewerLocation.lat, longitude: viewerLocation.lng }
    : null;
  data.radiusKm = Number.isFinite(radiusKm) ? radiusKm : null;

  return response.success(res, 200, 'Nearby requests retrieved successfully', data);
});

export const getRequestGoogleMaps = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request id');
  }

  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  const coordinates = getRequestCoordinates(request);
  if (!coordinates) {
    throw new HttpError(404, 'Request location is not available');
  }

  return response.success(res, 200, 'Request location retrieved successfully', {
    requestId: request._id.toString(),
    location: {
      lat: coordinates.latitude,
      lng: coordinates.longitude,
    },
  });
});

export const acceptRequest = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  if (req.user.role !== 'donor') {
    throw new HttpError(403, 'Access denied - donor role required');
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request id');
  }

  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  const donor = await Donor.findById(req.user.userId);
  if (!donor) {
    throw new HttpError(404, 'Donor not found');
  }

  await normalizeRequestIfExpired(request);

  // Guard: use the centralized state machine to validate pending -> accepted.
  // This also catches expired, completed, cancelled, and any other terminal states.
  try {
    validateTransition('request', request.status, 'accepted');
  } catch (err) {
    throw new HttpError(400, err.message);
  }

  if (request.acceptedBy) {
    throw new HttpError(400, 'Request has already been accepted');
  }

  const existingDonation = await Donation.findOne({
    donorId: donor._id,
    requestId: request._id,
    status: { $nin: ['cancelled', 'rejected', 'expired', 'abandoned'] },
  });

  if (existingDonation) {
    throw new HttpError(400, 'You have already responded to this request');
  }

  const eligibility = await donationService.validateEligibility(donor, request);
  if (!eligibility.eligible) {
    throw new HttpError(400, eligibility.reason || ELIGIBILITY_KEYS.DONOR_NOT_ELIGIBLE);
  }

  const session = await mongoose.startSession();
  let donation;
  let acceptedRequest;

  try {
    await session.withTransaction(async () => {
      const requestToUpdate = await Request.findById(request._id).session(session);
      if (!requestToUpdate) {
        throw new Error('Request not found');
      }

      // Guard against the narrow race window where requiredBy passes between
      // normalizeRequestIfExpired (outside the transaction) and this save.
      const now = new Date();
      if (requestToUpdate.requiredBy && requestToUpdate.requiredBy <= now) {
        // If the request is still pending, atomically expire it so the next
        // check (or subsequent retry) sees the correct state.
        if (requestToUpdate.status === 'pending') {
          try {
            validateTransition('request', requestToUpdate.status, 'expired');
          } catch (err) {
            throw new Error(err.message);
          }
          requestToUpdate.status = 'expired';
          requestToUpdate.expiredAt = now;
          await requestToUpdate.save({ session });
        }
        throw new Error('Request has expired — the deadline has passed');
      }

      try {
        validateTransition('request', requestToUpdate.status, 'accepted');
      } catch (err) {
        throw new Error(err.message);
      }

      if (requestToUpdate.acceptedBy) {
        throw new Error('Request has already been accepted');
      }

      const urgencyKey = requestToUpdate.isEmergency ? 'emergency' : (requestToUpdate.urgency || 'medium');
      const timeouts = URGENCY_TIMEOUTS[urgencyKey] || URGENCY_TIMEOUTS.medium;
      const arrivalWindowMs = timeouts.arrivalWindowMs;
      const qrExpires = new Date(now.getTime() + arrivalWindowMs);
      const qrToken = crypto.randomBytes(32).toString('hex');

      const donationDocs = await Donation.create([{
        donorId: donor._id,
        requestId: requestToUpdate._id,
        quantity: requestToUpdate.unitsNeeded ?? requestToUpdate.quantity ?? 1,
        status: 'pending',
        qrToken,
        qrExpires,
        arrivalDeadline: qrExpires,
        qrUsed: false,
      }], { session });
      donation = donationDocs[0];

      requestToUpdate.status = 'accepted';
      requestToUpdate.acceptedBy = donor._id;
      requestToUpdate.acceptedByName = donor.fullName || null;
      requestToUpdate.acceptedByPhoneNumber = donor.phoneNumber || null;
      requestToUpdate.acceptedByBloodType = donor.bloodType || null;
      requestToUpdate.acceptedAt = new Date();
      requestToUpdate.acceptedDonationId = donation._id;
      requestToUpdate.arrivalDeadline = qrExpires;
      await requestToUpdate.save({ session });

      validateOrphanState('request', requestToUpdate, { donation });
      acceptedRequest = requestToUpdate;
    });
  } catch (error) {
    // F18: Handle duplicate key error from unique partial index on acceptRequest
    if (error?.code === 11000 || (typeof error?.message === 'string' && error.message.includes('E11000'))) {
      throw new HttpError(409, 'You have already responded to this request');
    }
    throw error;
  } finally {
    session.endSession();
  }

  acceptedRequest = await populateRequest(Request.findById(acceptedRequest._id));

  await Notification.create({
    userId: acceptedRequest.hospitalId?._id || acceptedRequest.hospitalId,
    type: acceptedRequest.isEmergency || acceptedRequest.urgency === 'critical' ? 'emergency' : 'request',
    title: 'Request accepted',
    message: `${donor.fullName || 'A donor'} accepted the request for ${formatBloodTypeLabel(acceptedRequest.bloodType) || acceptedRequest.patientType || 'needed supplies'}.`,
    relatedId: acceptedRequest._id,
    relatedType: 'Request',
    data: {
      requestId: acceptedRequest._id,
      donorId: donor._id,
      donorName: donor.fullName || null,
      donorBloodType: donor.bloodType || null,
      status: acceptedRequest.status,
    },
  }).catch(() => {});

  const donorArrivalDeadline = acceptedRequest.arrivalDeadline;
  const hospitalName = acceptedRequest.hospitalId?.hospitalName || acceptedRequest.hospitalName || 'the hospital';
  const arrivalDeadlineISO = donorArrivalDeadline ? donorArrivalDeadline.toISOString() : null;
  const deadlineDisplay = donorArrivalDeadline ? new Date(donorArrivalDeadline).toLocaleString() : 'see details';
  const bloodTypeLabel = formatBloodTypeLabel(acceptedRequest.bloodType) || acceptedRequest.patientType || 'blood';

  await Notification.create({
    userId: donor._id,
    type: 'request',
    title: 'Donation Confirmed',
    message: `You've been assigned to ${hospitalName} for ${bloodTypeLabel}. Arrive by ${deadlineDisplay}. Open the request to view your QR code.`,
    relatedId: acceptedRequest._id,
    relatedType: 'Request',
    data: {
      requestId: acceptedRequest._id,
      donationId: donation._id.toString(),
      hospitalId: acceptedRequest.hospitalId?._id?.toString?.() || (typeof acceptedRequest.hospitalId === 'string' ? acceptedRequest.hospitalId : null),
      hospitalName,
      status: acceptedRequest.status,
      arrivalDeadline: arrivalDeadlineISO,
      qrToken: donation.qrToken,
    },
  }).catch(() => {});

  const donorUser = await User.findById(donor._id).select('fcmTokens');
  if (donorUser?.fcmTokens?.length) {
    const pushTitle = 'Proceed to Hospital';
    const pushBody = `${hospitalName} — arrive by ${deadlineDisplay}. Show your QR code on arrival.`;
    (sendToMultipleWithRetry || sendToMultiple)(
      donorUser.fcmTokens,
      pushTitle,
      pushBody,
      {
        type: 'request_accepted',
        requestId: acceptedRequest._id.toString(),
        donationId: donation._id.toString(),
        hospitalId: acceptedRequest.hospitalId?._id?.toString?.() || (typeof acceptedRequest.hospitalId === 'string' ? acceptedRequest.hospitalId : null),
        arrivalDeadline: arrivalDeadlineISO,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      { channelId: 'request_updates' },
      { attempts: 3, baseDelayMs: 200 },
    ).catch(() => {});
  }

  // Return minimal payload for Hospital Request flow
  return response.success(res, 200, 'Request accepted successfully', {
    requestId: acceptedRequest._id.toString(),
    donationId: donation._id.toString(),
    status: acceptedRequest.status,
    qrToken: donation.qrToken,
    qrExpiresAt: donation.qrExpires,
    acceptedAt: acceptedRequest.acceptedAt,
    arrivalDeadline: acceptedRequest.arrivalDeadline,
  });
});

export const cancelRequest = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request id');
  }

  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  await normalizeRequestIfExpired(request);

  // Guard: terminal requests cannot be cancelled in normal user-facing flows.
  try {
    validateTransition('request', request.status, 'cancelled');
  } catch (err) {
    throw new HttpError(400, err.message);
  }

  if (req.user.role === 'donor') {
    if (request.acceptedBy?.toString?.() !== req.user.userId) {
      throw new HttpError(403, 'You can only cancel your own accepted request');
    }

    const donation = await Donation.findOne({
      donorId: req.user.userId,
      requestId: request._id,
      status: { $nin: ['cancelled', 'rejected', 'expired', 'abandoned', 'completed'] },
    });

    // Invalidate QR on the donation (if found)
    if (donation) {
      await Donation.findByIdAndUpdate(donation._id, {
        $set: { qrUsed: true, qrUsedAt: new Date() },
      });
    }

    // Use donation id if found, otherwise fall back to the request's linked donation
    const cancellation = await rejectDonationLifecycle({
      donationId: donation?._id || request.acceptedDonationId || null,
      requestId: request._id,
      donorId: req.user.userId,
      donationStatus: 'cancelled',
      requestStatus: 'cancelled',
      reason: 'Donation cancelled by donor',
    });

    return response.success(res, 200, 'Request cancelled successfully', {
      requestId: cancellation.request._id.toString(),
      status: 'cancelled',
    });
  }

  if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
    throw new HttpError(403, 'Unauthorized');
  }

  if (req.user.role === 'hospital' && request.hospitalId?._id?.toString?.() !== req.user.userId) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  const cancelledAt = new Date();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const activeDonations = await Donation.find({ requestId: request._id, status: { $in: ['pending', 'scheduled'] } }).session(session);
      for (const donation of activeDonations) {
        validateTransition('donation', donation.status, 'cancelled');
        donation.status = 'cancelled';
        // Invalidate QR
        donation.qrUsed = true;
        donation.qrUsedAt = cancelledAt;
        await donation.save({ session });
      }

      request.status = 'cancelled';
      request.cancelledAt = cancelledAt;
      request.arrivalDeadline = null;
      request.qrToken = null;
      request.qrCreatedAt = null;
      request.qrExpiresAt = null;
      await request.save({ session });

      await appointmentService.cancelActiveAppointmentsForRequest(request._id, {
        cancelledAt,
        notes: 'Appointment cancelled because the linked request was cancelled',
        session,
      });
    });
  } finally {
    session.endSession();
  }

  return response.success(res, 200, 'Request cancelled successfully', {
    requestId: request._id.toString(),
    status: 'cancelled',
  });
});

export const confirmRequest = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
    throw new HttpError(403, 'Unauthorized');
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request id');
  }

  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  if (req.user.role === 'hospital' && request.hospitalId?._id?.toString?.() !== req.user.userId) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  if (!['accepted', 'in-progress'].includes(request.status)) {
    throw new HttpError(400, 'Request must be in accepted or in-progress status to confirm');
  }

  if (!request.acceptedBy || !request.acceptedDonationId) {
    throw new HttpError(400, 'No donor has accepted this request');
  }

  const donation = await Donation.findById(request.acceptedDonationId);
  if (!donation) {
    throw new HttpError(400, 'Associated donation not found');
  }

  const donor = await Donor.findById(request.acceptedBy);
  if (!donor) {
    throw new HttpError(400, 'Associated donor not found');
  }

  // Donor is eligible — complete the donation and request atomically
  // Deadline and QR-expiry checks are re-verified inside the transaction (F3/F4)
  const session = await mongoose.startSession();
  let updatedDonation;
  let updatedRequest;

  try {
    await session.withTransaction(async () => {
      const sessionDonation = await Donation.findById(donation._id).session(session);
      if (!sessionDonation) throw new Error('Donation not found');

      // F3: Atomic deadline check inside transaction
      const sessionNow = new Date();
      if (sessionDonation.arrivalDeadline && sessionNow > new Date(sessionDonation.arrivalDeadline)) {
        throw new Error('ARRIVAL_DEADLINE_PASSED');
      }
      if (sessionDonation.qrExpires && sessionNow > new Date(sessionDonation.qrExpires)) {
        throw new Error('QR_EXPIRED');
      }

      const sessionRequest = await Request.findById(request._id).session(session);
      if (!sessionRequest) throw new Error('Request not found');

      if (!['accepted', 'in-progress'].includes(sessionRequest.status)) {
        throw new Error('Request must be in accepted or in-progress status to confirm');
      }
      if (!sessionRequest.acceptedBy || !sessionRequest.acceptedDonationId) {
        throw new Error('No donor has accepted this request');
      }

      const sessionDonor = await Donor.findById(sessionRequest.acceptedBy).session(session);
      if (!sessionDonor) throw new Error('Associated donor not found');

      // F4: Re-run eligibility inside the transaction to prevent TOCTOU
      const eligibility = await matchingService.checkEligibility(sessionDonor, sessionRequest, {
        excludeDonationId: sessionDonation._id,
      });
      if (!eligibility.eligible) {
        // Donor is no longer eligible — reject donation, reopen request, re-broadcast
        // This runs inside the transaction so the rejection atomic with the eligibility check
        throw Object.assign(new Error('DONOR_INELIGIBLE'), { reason: eligibility.reason });
      }

      validateTransition('donation', sessionDonation.status, 'completed');

      sessionDonation.status = 'completed';
      sessionDonation.completedDate = new Date();
      await sessionDonation.save({ session });
      updatedDonation = sessionDonation;

      validateTransition('request', sessionRequest.status, 'completed');

      sessionRequest.status = 'completed';
      sessionRequest.completedAt = new Date();
      await sessionRequest.save({ session });
      updatedRequest = sessionRequest;

      // Update donor lastDonationDate
      await Donor.findByIdAndUpdate(sessionDonor._id, { lastDonationDate: new Date() }, { session });

      validateOrphanState('request', sessionRequest, { donation: sessionDonation });
    });
  } catch (err) {
    session.endSession();

    // Handle deadline/eligibility errors with meaningful responses
    if (err.message === 'ARRIVAL_DEADLINE_PASSED') {
      throw new HttpError(400, 'Arrival deadline has passed — confirmation no longer accepted');
    }
    if (err.message === 'QR_EXPIRED') {
      throw new HttpError(400, 'QR code has expired — confirmation no longer accepted');
    }
    if (err.message === 'DONOR_INELIGIBLE') {
      // Donor is ineligible — reject donation, reopen request, re-broadcast
      try {
        const result = await rejectDonationLifecycle({
          donationId: donation._id,
          requestId: request._id,
          donorId: donor._id,
          donationStatus: 'rejected',
          requestStatus: 'pending',
          reason: err.reason || 'Donor no longer eligible at confirmation time',
          rejectedBy: req.user.userId,
        });

        return response.success(res, 200, 'Donor is no longer eligible. Request has been reopened for other donors.', {
          requestId: result.request._id.toString(),
          status: result.request.status,
        });
      } catch (rejectErr) {
        throw rejectErr;
      }
    }
    throw err;
  } finally {
    if (session && session.id) session.endSession();
  }

  // Fire-and-forget side-effects: reward processing, activity logging, notifications
  const isEmergency = updatedRequest.isEmergency || updatedRequest.urgency === 'critical';

  try {
    const { onDonationCompleted } = await import('../services/reward.service.js');
    await onDonationCompleted(donor._id, updatedDonation._id, isEmergency);
  } catch (rewardErr) {
    // Reward processing failure must not break the flow
  }

  try {
    const { default: activitySvc } = await import('../services/activity.service.js');
    await activitySvc.logActivity(donor._id, {
      type: 'donation',
      action: 'completed_donation',
      title: 'Donation Completed',
      description: `Successfully completed donation of ${updatedDonation.quantity} unit(s) at hospital`,
      referenceId: updatedDonation._id.toString(),
      referenceType: 'Donation',
      metadata: {
        requestId: updatedRequest._id.toString(),
        donationId: updatedDonation._id.toString(),
        quantity: updatedDonation.quantity,
        completedAt: updatedDonation.completedDate,
      },
    });
  } catch (_err) { /* non-critical */ }

  // Notify donor
  try {
    await Notification.create({
      userId: donor._id,
      type: 'request',
      title: 'Donation confirmed',
      message: `Your donation for ${formatBloodTypeLabel(updatedRequest.bloodType) || updatedRequest.patientType || 'blood request'} has been confirmed by the hospital.`,
      relatedId: updatedRequest._id,
      relatedType: 'Request',
      data: {
        requestId: updatedRequest._id,
        donationId: updatedDonation._id,
        status: 'completed',
      },
    });
  } catch (_err) { /* non-critical */ }

  return response.success(res, 200, 'Donation confirmed and completed successfully', {
    requestId: updatedRequest._id.toString(),
    donationId: updatedDonation._id.toString(),
    status: 'completed',
  });
});

export const getAcceptedRequests = asyncHandler(async (req, res) => {
  if (req.user.role !== 'donor') {
    throw new HttpError(403, 'Access denied - donor role required');
  }

  const { page: queryPage, limit: queryLimit } = req.query;
  const { page, limit, offset } = parsePagination(req.query, 20);

  const donations = await Donation.find({
    donorId: req.user.userId,
    status: { $nin: ['cancelled', 'rejected', 'abandoned'] },
  })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);

  const total = await Donation.countDocuments({
    donorId: req.user.userId,
    status: { $nin: ['cancelled', 'rejected', 'abandoned'] },
  });

  const requestIds = donations.map((d) => d.requestId).filter(Boolean);
  const requests = await Request.find({ _id: { $in: requestIds } })
    .populate('hospitalId', 'fullName hospitalName address contactNumber location');

  const requestMap = new Map(requests.map((r) => [r._id.toString(), r]));
  const donationMap = new Map(donations.map((d) => [d.requestId?.toString(), d]));

const items = requests
    .filter((r) => ['accepted', 'in-progress'].includes(r.status))
    .map((r) => {
      const donation = donationMap.get(r._id.toString());
      const now = new Date();
      const qrExpired = donation?.qrExpires ? now > new Date(donation.qrExpires) : true;
      const arrivalDeadlinePassed = donation?.arrivalDeadline ? now > new Date(donation.arrivalDeadline) : false;

      return {
        requestId: r._id.toString(),
        donationId: donation?._id?.toString() || null,
        status: r.status,
        donationStatus: donation?.status || null,
        acceptedAt: r.acceptedAt,
        arrivalDeadline: donation?.arrivalDeadline || null,
        qrExpiresAt: donation?.qrExpires || null,
        qrExpired,
        arrivalDeadlinePassed,
        bloodType: normalizeBloodTypeList(r.bloodType),
        bloodTypeLabel: formatBloodTypeLabel(r.bloodType),
        urgency: r.urgency,
        unitsNeeded: r.unitsNeeded ?? r.quantity ?? 1,
        patientType: r.patientType || r.cause || null,
        isEmergency: Boolean(r.isEmergency || r.urgency === 'critical'),
        hospitalName: r.hospitalName || r.hospitalId?.hospitalName || r.hospitalId?.fullName || null,
        contactNumber: r.contactNumber || r.hospitalContact || r.hospitalId?.contactNumber || null,
        hospitalId: r.hospitalId?._id?.toString?.() || r.hospitalId?.toString?.() || null,
        hospitalAddress: r.hospitalId?.address || null,
        hospitalLocation: r.locationHospital || null,
      };
    });

  const meta = paginationMeta(items.length, page, limit);
  return response.success(res, 200, 'Accepted requests retrieved successfully', {
    requests: items,
    pagination: meta,
  });
});

export const getAcceptedRequestDetails = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  if (req.user.role !== 'donor') {
    throw new HttpError(403, 'Access denied - donor role required');
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request id');
  }

  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  // Only the donor who accepted this request can view it
  if (request.acceptedBy?.toString?.() !== req.user.userId) {
    throw new HttpError(403, 'You can only view requests you have accepted');
  }

  const donation = await Donation.findOne({
    donorId: req.user.userId,
    requestId: request._id,
    status: { $nin: ['cancelled', 'rejected', 'abandoned'] },
  });

  if (!donation) {
    throw new HttpError(404, 'No active donation found for this request');
  }

  const now = new Date();
  const qrExpired = donation.qrExpires ? now > new Date(donation.qrExpires) : true;
  const arrivalDeadlinePassed = donation.arrivalDeadline ? now > new Date(donation.arrivalDeadline) : false;
  const isEligible = !qrExpired && !arrivalDeadlinePassed && donation.qrToken && !donation.qrUsed;

  return response.success(res, 200, 'Accepted request details retrieved successfully', {
    requestId: request._id.toString(),
    donationId: donation._id.toString(),
    status: request.status,
    donationStatus: donation.status,
    acceptedAt: request.acceptedAt,
    arrivalDeadline: donation.arrivalDeadline,
    qrToken: donation.qrToken,
    qrExpiresAt: donation.qrExpires,
    qrUsed: donation.qrUsed,
    qrUsedAt: donation.qrUsedAt,
    qrExpired,
    arrivalDeadlinePassed,
    isEligible,
    request: {
      bloodType: normalizeBloodTypeList(request.bloodType),
      bloodTypeLabel: formatBloodTypeLabel(request.bloodType),
      type: request.type,
      unitsNeeded: request.unitsNeeded ?? request.quantity ?? 1,
      urgency: request.urgency,
      patientType: request.patientType || request.cause || null,
      notes: request.notes || null,
      isEmergency: Boolean(request.isEmergency || request.urgency === 'critical'),
      requiredBy: request.requiredBy,
      createdAt: request.createdAt,
    },
    hospital: {
      id: request.hospitalId?._id?.toString?.() || request.hospitalId?.toString?.() || null,
      hospitalName: request.hospitalName || request.hospitalId?.hospitalName || request.hospitalId?.fullName || null,
      phoneNumber: request.contactNumber || request.hospitalContact || request.hospitalId?.contactNumber || null,
      address: request.hospitalId?.address || null,
      location: request.locationHospital || null,
    },
  });
});

export const expireArrival = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request id');
  }

  const request = await Request.findById(id);
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  if (!['admin', 'superadmin'].includes(req.user.role)) {
    throw new HttpError(403, 'Unauthorized - admin access required');
  }

  if (request.status !== 'accepted') {
    throw new HttpError(400, 'Request is not in accepted status');
  }

  const donation = await Donation.findOne({
    requestId: request._id,
    _id: request.acceptedDonationId,
    status: 'pending',
  });

  if (!donation) {
    throw new HttpError(400, 'No active pending donation found for this request');
  }

  const now = new Date();
  const arrivalDeadline = donation.arrivalDeadline;

  if (!arrivalDeadline || now <= new Date(arrivalDeadline)) {
    throw new HttpError(400, 'Arrival deadline has not passed yet');
  }

  // Expire the donation, invalidate QR, reopen the request
  // rejectDonationLifecycle handles: donation status, qrUsed, qrUsedAt, request status, arrivalDeadline=null
  const result = await rejectDonationLifecycle({
    donationId: donation._id,
    requestId: request._id,
    donorId: request.acceptedBy,
    donationStatus: 'expired',
    requestStatus: 'pending',
    reason: 'Donor did not arrive before the arrival deadline',
  });

  // Re-broadcast to compatible donors
  try {
    const matchingSvc = await import('../services/matching.service.js');
    const notificationSvc = await import('../services/notification.service.js');
    const compatibleDonors = await matchingSvc.findCompatibleDonors(request._id);
    if (compatibleDonors.length > 0) {
      const donorIds = compatibleDonors.map((d) => d.donor._id);
      await notificationSvc.notifyRequest(donorIds, request);
    }
  } catch (broadcastErr) {
    // Non-critical — don't fail the expiry
  }

  return response.success(res, 200, 'Donation expired and request reopened for other donors', {
    requestId: result.request._id.toString(),
    status: result.request.status,
  });
});

export const rejectRequest = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
    throw new HttpError(403, 'Unauthorized');
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request id');
  }

  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  await normalizeRequestIfExpired(request);

  if (req.user.role === 'hospital' && request.hospitalId?._id?.toString?.() !== req.user.userId) {
    throw new HttpError(403, 'Unauthorized access to this request');
  }

  if (!request.acceptedDonationId && !request.acceptedBy) {
    throw new HttpError(400, 'Request has no accepted donation to reject');
  }

  const result = await rejectDonationLifecycle({
    donationId: request.acceptedDonationId,
    requestId: request._id,
    donorId: request.acceptedBy,
    reason: req.body?.reason || 'Donation rejected by hospital',
    rejectedBy: req.user.userId,
    requestStatus: 'pending',
  });

  return response.success(res, 200, 'Request rejected successfully', {
    request: getRequestSummary(result.request),
    donation: result.donation,
  });
});
