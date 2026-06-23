import crypto from 'crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import response from '../utils/response.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import Appointment from '../models/Appointment.model.js';
import Donor from '../models/Donor.model.js';
import User from '../models/User.model.js';
import Notification from '../models/Notification.model.js';
import * as donationService from '../services/donation.service.js';
import * as appointmentService from '../services/appointment.service.js';
import * as eligibilityService from '../services/eligibility.service.js';
import * as matchingService from '../services/matching.service.js';
import * as requestService from '../services/request.service.js';
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
import { MISSED_DONATION_THRESHOLD } from '../constants/donation.constants.js';
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

export const buildRequestPayload = (request, viewerLocation = null, { responseCount = 0, donations = null, role = null, donorActiveQr = null } = {}) => {
  const requestLocation = getRequestCoordinates(request);
  const distance = computeDistanceDetails(viewerLocation, request);
  const hospitalName = request.hospitalName
    || request.hospitalId?.hospitalName
    || request.hospitalId?.fullName
    || null;
  const contactNumber = request.contactNumber
    || request.hospitalContact
    || request.hospitalId?.contactNumber
    || request.hospitalId?.phone
    || null;

  const payload = {
    id: request._id.toString(),
    requestId: request._id.toString(),
    bloodType: normalizeBloodTypeList(request.bloodType),
    bloodTypeLabel: formatBloodTypeLabel(request.bloodType),
    hospitalName,
    patientType: request.patientType || null,
    patientDetails: request.patientDetails || null,
    contactNumber,
    unitsNeeded: request.unitsNeeded ?? 1,
    isEmergency: Boolean(request.isEmergency || request.urgency === 'critical'),
    createdAt: request.createdAt,
    status: request.status,
    requestStatus: request.status,
    urgency: request.urgency,
    type: request.type,
    requiredBy: request.requiredBy,
    location: toLocation(requestLocation),
    qrToken: donorActiveQr ? donorActiveQr.qrToken : (request.qrToken || null),
    qrCreatedAt: donorActiveQr ? donorActiveQr.qrCreatedAt : (request.qrCreatedAt || null),
    qrExpiresAt: donorActiveQr ? donorActiveQr.qrExpiresAt : (request.qrExpiresAt || null),
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
    || request.hospitalId?.phone
    || null;

  return {
    _id: request._id.toString(),
    id: request._id.toString(),
    requestId: request._id.toString(),
    posted: request.createdAt || null,
    patientType: request.patientType || null,
    patientDetails: request.patientDetails || null,
    contactNumber,
    unitsNeeded: request.unitsNeeded ?? 1,
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
  return query.populate('hospitalId', 'fullName hospitalName address phone contactNumber location');
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
          // Invalidate the request-level QR so a hospital viewer cannot read
          // a stale token out of GET /requests/:id after natural expiration.
          // Cancellation already does this; natural expiration must too.
          currentRequest.qrToken = null;
          currentRequest.qrCreatedAt = null;
          currentRequest.qrExpiresAt = null;
          await currentRequest.save({ session });

          // Update the original request object with new state
          request.status = currentRequest.status;
          request.expiredAt = currentRequest.expiredAt;
          request.qrToken = currentRequest.qrToken;
          request.qrCreatedAt = currentRequest.qrCreatedAt;
          request.qrExpiresAt = currentRequest.qrExpiresAt;
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

/**
 * Resolves the active QR token for a specific donor on a specific request.
 * Appointment QR takes precedence over donation QR when the donor has booked a slot.
 * Returns an object with QR fields, or null if the donor has no active donation.
 */
const resolveActiveDonorQr = async (donorId, requestId) => {
  const donation = await Donation.findOne({
    donorId,
    requestId,
    status: { $nin: ['cancelled', 'rejected', 'expired', 'abandoned'] },
  });

  if (!donation) return null;

  if (donation.appointmentId) {
    const appointment = await Appointment.findById(donation.appointmentId);
    if (appointment && ['pending', 'confirmed'].includes(appointment.status)) {
      return {
        qrToken: appointment.qrToken || null,
        qrCreatedAt: appointment.createdAt || null,
        qrExpiresAt: appointment.qrExpiresAt || null,
        arrivalDeadline: appointment.appointmentDate || donation.arrivalDeadline,
        donation,
      };
    }
  }

  // No active appointment — fall back to the donation-level QR (urgent walk-in path)
  if (['pending', 'scheduled'].includes(donation.status)) {
    return {
      qrToken: donation.qrToken || null,
      qrCreatedAt: donation.createdAt || null,
      qrExpiresAt: donation.qrExpiresAt || null,
      arrivalDeadline: donation.arrivalDeadline,
      donation,
    };
  }

  // Donation exists but is in a non-displayable state (e.g. completed before QR cleared)
  return { qrToken: null, qrCreatedAt: null, qrExpiresAt: null, arrivalDeadline: null, donation };
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
    throw new HttpError(400, 'Invalid request ID format');
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

  if (donation.qrExpiresAt && now > new Date(donation.qrExpiresAt)) {
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
    patientType: request.patientType || null,
    patientDetails: request.patientDetails || null,
    contactNumber: request.contactNumber || request.hospitalContact || request.hospitalId?.contactNumber || request.hospitalId?.phone || null,
    unitsNeeded: request.unitsNeeded ?? 1,
    isEmergency: Boolean(request.isEmergency || request.urgency === 'critical'),
    createdAt: request.createdAt,
    requestStatus: request.status,
    donationStatus: donation.status,
    donorName: donorDoc?.fullName || null,
    donorBloodType: donorDoc?.bloodType || null,
    qrToken: donation.qrToken || null,
    qrExpiresAt: donation.qrExpiresAt || null,
    arrivalDeadline: donation.arrivalDeadline || null,
  });
});

export const getRequestDetails = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request ID format');
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

  // For donors: always pass an explicit QR object so buildRequestPayload does NOT
  // fall through to the request-level (hospital) QR token for donors with no donation.
  let donorQrOverride = null;
  if (req.user?.role === 'donor') {
    const resolvedQr = await resolveActiveDonorQr(req.user.userId, request._id);
    donorQrOverride = resolvedQr ?? { qrToken: null, qrCreatedAt: null, qrExpiresAt: null };
  }

  const payload = buildRequestPayload(request, viewerLocation, {
    responseCount: donations?.length || 0,
    donations: donations || undefined,
    role: req.user?.role,
    donorActiveQr: donorQrOverride,
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
    throw new HttpError(400, 'Invalid request ID format');
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

const sendAcceptNotifications = async ({
  acceptedRequest, donation, donor, isFullyAccepted, unitsAccepted, unitsNeeded,
}) => {
  const hospitalName = acceptedRequest.hospitalId?.hospitalName || acceptedRequest.hospitalName || 'the hospital';
  const bloodTypeLabel = formatBloodTypeLabel(acceptedRequest.bloodType) || acceptedRequest.patientType || 'blood';
  const unitsRemaining = Math.max(0, unitsNeeded - unitsAccepted);
  const donorArrivalDeadline = donation.arrivalDeadline || acceptedRequest.arrivalDeadline;
  const arrivalDeadlineISO = donorArrivalDeadline ? donorArrivalDeadline.toISOString() : null;
  const deadlineDisplay = donorArrivalDeadline ? new Date(donorArrivalDeadline).toLocaleString() : 'see details';

  const hospitalMessage = isFullyAccepted
    ? `${donor?.fullName || 'A donor'} accepted the final unit for ${bloodTypeLabel}. Request fully fulfilled.`
    : `${donor?.fullName || 'A donor'} pledged ${donation.quantity || 1} unit(s) for ${bloodTypeLabel}. ${unitsRemaining} more needed.`;

  await Notification.create({
    userId: acceptedRequest.hospitalId?._id || acceptedRequest.hospitalId,
    type: acceptedRequest.isEmergency || acceptedRequest.urgency === 'critical' ? 'emergency' : 'request',
    title: isFullyAccepted ? 'Request fully accepted' : 'New donor response',
    message: hospitalMessage,
    relatedId: acceptedRequest._id,
    relatedType: 'Request',
    data: {
      requestId: acceptedRequest._id,
      donorId: donor?._id,
      donorName: donor?.fullName || null,
      donorBloodType: donor?.bloodType || null,
      status: acceptedRequest.status,
      unitsAccepted,
      unitsNeeded,
      fullyAccepted: isFullyAccepted,
    },
  }).catch(() => {});

  await Notification.create({
    userId: donor?._id,
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

  const [donorUser, hospitalUser] = await Promise.all([
    User.findById(donor?._id).select('fcmTokens'),
    User.findById(acceptedRequest.hospitalId?._id || acceptedRequest.hospitalId).select('fcmTokens'),
  ]);

  if (donorUser?.fcmTokens?.length) {
    sendToMultipleWithRetry(
      donorUser.fcmTokens,
      'Proceed to Hospital',
      `${hospitalName} — arrive by ${deadlineDisplay}. Show your QR code on arrival.`,
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

  if (hospitalUser?.fcmTokens?.length) {
    const pushTitle = isFullyAccepted ? 'Request Fully Accepted' : 'New Donor Pledged';
    const pushBody = isFullyAccepted
      ? `${donor?.fullName || 'A donor'} accepted the final unit for ${bloodTypeLabel}. All donors — scan their QR codes on arrival.`
      : `${donor?.fullName || 'A donor'} pledged ${donation.quantity || 1} unit(s) for ${bloodTypeLabel}. ${unitsRemaining} more needed.`;
    sendToMultipleWithRetry(
      hospitalUser.fcmTokens,
      pushTitle,
      pushBody,
      {
        type: 'donor_accepted',
        requestId: acceptedRequest._id.toString(),
        donationId: donation._id.toString(),
        donorId: donor?._id?.toString(),
        donorName: donor?.fullName || null,
        donorBloodType: donor?.bloodType || null,
        status: acceptedRequest.status,
        unitsAccepted,
        unitsNeeded,
        fullyAccepted: isFullyAccepted,
        arrivalDeadline: arrivalDeadlineISO,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      { channelId: 'request_updates' },
      { attempts: 3, baseDelayMs: 200 },
    ).catch(() => {});
  }
};

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
    throw new HttpError(400, 'Invalid request ID format');
  }

  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  await normalizeRequestIfExpired(request);

  let result;
  try {
    result = await requestService.acceptRequest({
      donorId: req.user.userId,
      requestId: id,
    });
  } catch (error) {
    if (error?.code === 11000 || (typeof error?.message === 'string' && error.message.includes('E11000'))) {
      throw new HttpError(409, 'You have already responded to this request');
    }
    if (error.statusCode === 404) throw new HttpError(404, error.message);
    if (error.statusCode === 400) throw new HttpError(400, error.message);
    if (error.statusCode === 409) throw new HttpError(409, error.message);
    throw error;
  }

  const { donation, fullyAccepted } = result;
  const acceptedRequest = await populateRequest(Request.findById(result.request._id));
  const donor = await Donor.findById(req.user.userId);

  const unitsAccepted = acceptedRequest.unitsAccepted || 0;
  const unitsNeeded = acceptedRequest.unitsNeeded || 1;
  const missedDonationCount = donor?.missedDonationCount || 0;
  const missedDonationRemaining = Math.max(0, MISSED_DONATION_THRESHOLD - missedDonationCount);

  sendAcceptNotifications({
    acceptedRequest, donation, donor, isFullyAccepted: fullyAccepted,
    unitsAccepted, unitsNeeded,
  });

  return response.success(res, 200, fullyAccepted ? 'Request fully accepted' : 'Response submitted', {
    requestId: acceptedRequest._id.toString(),
    donationId: donation._id.toString(),
    status: acceptedRequest.status,
    qrToken: donation.qrToken || null,
    qrExpiresAt: donation.qrExpiresAt || null,
    acceptedAt: donation.createdAt,
    arrivalDeadline: donation.arrivalDeadline || null,
    unitsAccepted,
    unitsNeeded,
    fullyAccepted,
    missedDonationCount,
    missedDonationRemaining,
  });
});

export const cancelRequest = asyncHandler(async (req, res) => {
  const validation = validateRequestIdParam(req.params);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0]);
  }

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid request ID format');
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
    throw new HttpError(400, 'Invalid request ID format');
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
      if (sessionDonation.qrExpiresAt && sessionNow > new Date(sessionDonation.qrExpiresAt)) {
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
    .populate('hospitalId', 'fullName hospitalName address phone contactNumber location');

  const requestMap = new Map(requests.map((r) => [r._id.toString(), r]));
  const donationMap = new Map(donations.map((d) => [d.requestId?.toString(), d]));

const items = requests
    .filter((r) => ['pending', 'accepted', 'in-progress'].includes(r.status))
    .map((r) => {
      const donation = donationMap.get(r._id.toString());
      const now = new Date();
      const qrExpired = donation?.qrExpiresAt ? now > new Date(donation.qrExpiresAt) : true;
      const arrivalDeadlinePassed = donation?.arrivalDeadline ? now > new Date(donation.arrivalDeadline) : false;

      return {
        requestId: r._id.toString(),
        donationId: donation?._id?.toString() || null,
        status: r.status,
        donationStatus: donation?.status || null,
        acceptedAt: r.acceptedAt,
        qrToken: donation?.qrToken || null,
        arrivalDeadline: donation?.arrivalDeadline || r.arrivalDeadline || null,
        qrExpiresAt: donation?.qrExpiresAt || r.qrExpiresAt || null,
        qrExpired,
        arrivalDeadlinePassed,
        bloodType: normalizeBloodTypeList(r.bloodType),
        bloodTypeLabel: formatBloodTypeLabel(r.bloodType),
        urgency: r.urgency,
        unitsNeeded: r.unitsNeeded ?? 1,
        unitsAccepted: r.unitsAccepted ?? 0,
        fullyAccepted: (r.unitsAccepted ?? 0) >= (r.unitsNeeded ?? 1),
        patientType: r.patientType || null,
        patientDetails: r.patientDetails || null,
        isEmergency: Boolean(r.isEmergency || r.urgency === 'critical'),
        hospitalName: r.hospitalName || r.hospitalId?.hospitalName || r.hospitalId?.fullName || null,
        contactNumber: r.contactNumber || r.hospitalContact || r.hospitalId?.contactNumber || r.hospitalId?.phone || null,
        hospitalId: r.hospitalId?._id?.toString?.() || r.hospitalId?.toString?.() || null,
        hospitalAddress: r.hospitalId?.address || null,
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
    throw new HttpError(400, 'Invalid request ID format');
  }

  const request = await populateRequest(Request.findById(id));
  if (!request) {
    throw new HttpError(404, 'Request not found');
  }

  // Only donors with an active donation for this request can view it
  const donation = await Donation.findOne({
    donorId: req.user.userId,
    requestId: request._id,
    status: { $nin: ['cancelled', 'rejected', 'abandoned'] },
  });

  if (!donation) {
    throw new HttpError(404, 'No active donation found for this request');
  }

  const now = new Date();

  let activeQr = {
    qrToken: donation.qrToken,
    qrExpiresAt: donation.qrExpiresAt,
    qrCreatedAt: donation.createdAt,
    arrivalDeadline: donation.arrivalDeadline ?? request.arrivalDeadline,
  };

  const resolvedQr = await resolveActiveDonorQr(req.user.userId, request._id);
  if (resolvedQr) {
    activeQr = {
      qrToken: resolvedQr.qrToken ?? donation.qrToken,
      qrExpiresAt: resolvedQr.qrExpiresAt ?? donation.qrExpiresAt,
      qrCreatedAt: resolvedQr.qrCreatedAt ?? donation.createdAt,
      arrivalDeadline: resolvedQr.arrivalDeadline ?? donation.arrivalDeadline ?? request.arrivalDeadline,
    };
  }

  const qrExpired = activeQr.qrExpiresAt ? now > new Date(activeQr.qrExpiresAt) : true;
  const arrivalDeadlinePassed = activeQr.arrivalDeadline ? now > new Date(activeQr.arrivalDeadline) : false;
  const isEligible = !qrExpired && !arrivalDeadlinePassed && activeQr.qrToken && !donation.qrUsed;

  return response.success(res, 200, 'Accepted request details retrieved successfully', {
    requestId: request._id.toString(),
    donationId: donation._id.toString(),
    status: request.status,
    donationStatus: donation.status,
    acceptedAt: request.acceptedAt,
    arrivalDeadline: activeQr.arrivalDeadline,
    qrToken: activeQr.qrToken,
    qrExpiresAt: activeQr.qrExpiresAt,
    qrUsed: donation.qrUsed,
    qrUsedAt: donation.qrUsedAt,
    qrExpired,
    arrivalDeadlinePassed,
    isEligible,
    unitsAccepted: request.unitsAccepted ?? 0,
    unitsNeeded: request.unitsNeeded ?? 1,
    fullyAccepted: (request.unitsAccepted ?? 0) >= (request.unitsNeeded ?? 1),
    request: {
      bloodType: normalizeBloodTypeList(request.bloodType),
      bloodTypeLabel: formatBloodTypeLabel(request.bloodType),
      type: request.type,
      unitsNeeded: request.unitsNeeded ?? 1,
      urgency: request.urgency,
      patientType: request.patientType || null,
      patientDetails: request.patientDetails || null,
      notes: request.notes || null,
      isEmergency: Boolean(request.isEmergency || request.urgency === 'critical'),
      requiredBy: request.requiredBy,
      createdAt: request.createdAt,
    },
    hospital: {
      id: request.hospitalId?._id?.toString?.() || request.hospitalId?.toString?.() || null,
      hospitalName: request.hospitalName || request.hospitalId?.hospitalName || request.hospitalId?.fullName || null,
      phoneNumber: request.contactNumber || request.hospitalContact || request.hospitalId?.contactNumber || request.hospitalId?.phone || null,
      address: request.hospitalId?.address || null,
      location: request.hospitalLocationGeo || null,
    },
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
    throw new HttpError(400, 'Invalid request ID format');
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
