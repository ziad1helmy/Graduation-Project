import crypto from 'crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import response from '../utils/response.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import Notification from '../models/Notification.model.js';
import * as donationService from '../services/donation.service.js';
import * as appointmentService from '../services/appointment.service.js';
import * as eligibilityService from '../services/eligibility.service.js';
import * as matchingService from '../services/matching.service.js';
import { rejectDonationLifecycle } from '../services/request-lifecycle.service.js';
import { calculateDistance } from '../utils/geo.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
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

const QR_TTL_MS = 2 * 60 * 60 * 1000;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseViewerLocation = (query = {}) => {
  const latitude = toNumber(query.lat ?? query.latitude);
  const longitude = toNumber(query.lng ?? query.long ?? query.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

const getRequestCoordinates = (request) => {
  const latitude = toNumber(
    request.locationHospital?.latitude
      ?? request.hospitalLocation?.lat
      ?? request.hospitalLocationGeo?.coordinates?.[1]
      ?? request.hospitalId?.location?.coordinates?.lat
      ?? request.hospitalId?.lat
  );
  const longitude = toNumber(
    request.locationHospital?.longitude
      ?? request.hospitalLocation?.lng
      ?? request.hospitalLocationGeo?.coordinates?.[0]
      ?? request.hospitalId?.location?.coordinates?.lng
      ?? request.hospitalId?.long
  );

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
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

const computeDistanceDetails = (viewerLocation, request) => {
  const requestLocation = getRequestCoordinates(request);
  if (!viewerLocation || !requestLocation) {
    return {
      distanceKm: null,
      distanceMeters: null,
      distance: null,
    };
  }

  const distanceKm = calculateDistance(
    { lat: viewerLocation.latitude, long: viewerLocation.longitude },
    { lat: requestLocation.latitude, long: requestLocation.longitude }
  );

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    distanceMeters: Math.round(distanceKm * 1000),
    distance: formatDistance(distanceKm),
  };
};

export const buildRequestPayload = (request, viewerLocation = null, { responseCount = 0, donations = null } = {}) => {
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

  return {
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
    validateTransition('request', request.status, 'expired');
    request.status = 'expired';
    await request.save({ validateBeforeSave: false });
  }

  return request;
};

const getRequestSummary = (request, viewerLocation = null) => buildRequestPayload(request, viewerLocation);

const canAccessRequest = (request, req) => {
  if (req.user.role === 'admin' || req.user.role === 'superadmin') return true;
  if (req.user.role === 'hospital') {
    return request.hospitalId?._id?.toString?.() === req.user.userId;
  }
  return false;
};

export const generateQr = async (req, res, next) => {
  try {
    const validation = validateRequestIdParam(req.params);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
      return response.error(res, 403, 'Unauthorized');
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return response.error(res, 400, 'Invalid request id');
    }

    const request = await populateRequest(Request.findById(id));
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    if (!canAccessRequest(request, req)) {
      return response.error(res, 403, 'Unauthorized access to this request');
    }

    if (['completed', 'cancelled'].includes(request.status)) {
      return response.error(res, 400, 'QR cannot be generated for a closed request');
    }
    if (request.status === 'expired') {
      return response.error(res, 400, 'QR cannot be generated for an expired request');
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
  } catch (error) {
    next(error);
  }
};

export const verifyQr = async (req, res, next) => {
  try {
    const validation = validateQrBody(req.body);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
      return response.error(res, 403, 'Unauthorized');
    }

    const qrToken = String(req.body.qrToken || req.body.qrCode).trim();

    const request = await populateRequest(Request.findOne({ qrToken }));
    if (!request) {
      return response.success(res, 200, 'QR verification completed', {
        valid: false,
        message: 'Invalid or expired QR token',
      });
    }

    await normalizeRequestIfExpired(request);
    if (request.status === 'expired' || (request.qrExpiresAt && new Date() > new Date(request.qrExpiresAt))) {
      return response.success(res, 200, 'QR verification completed', {
        valid: false,
        message: 'Invalid or expired QR token',
      });
    }

    return response.success(res, 200, 'QR verified successfully', {
      valid: true,
      requestId: request._id,
      hospitalName: request.hospitalName || request.hospitalId?.hospitalName || request.hospitalId?.fullName || null,
      bloodType: normalizeBloodTypeList(request.bloodType),
      bloodTypeLabel: formatBloodTypeLabel(request.bloodType),
      patientType: request.patientType || request.cause || null,
      contactNumber: request.contactNumber || request.hospitalContact || request.hospitalId?.contactNumber || null,
      unitsNeeded: request.unitsNeeded ?? request.quantity ?? 1,
      isEmergency: Boolean(request.isEmergency || request.urgency === 'critical'),
      createdAt: request.createdAt,
      status: request.status,
      locationHospital: request.locationHospital || null,
      qrToken: request.qrToken,
      qrCreatedAt: request.qrCreatedAt,
      qrExpiresAt: request.qrExpiresAt,
    });
  } catch (error) {
    next(error);
  }
};

export const getRequestDetails = async (req, res, next) => {
  try {
    const validation = validateRequestIdParam(req.params);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return response.error(res, 400, 'Invalid request id');
    }

    const viewerLocation = parseViewerLocation(req.query);
    const request = await populateRequest(Request.findById(id));
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    await normalizeRequestIfExpired(request);

    if (req.user.role === 'hospital' && request.hospitalId?._id?.toString?.() !== req.user.userId) {
      return response.error(res, 403, 'Unauthorized access to this request');
    }

    const donations = req.user.role === 'hospital' || req.user.role === 'admin' || req.user.role === 'superadmin'
      ? await Donation.find({ requestId: request._id }).populate('donorId', 'fullName email phoneNumber location bloodType lastDonationDate')
      : null;

    return response.success(res, 200, 'Request details retrieved successfully', {
      ...buildRequestPayload(request, viewerLocation, {
        responseCount: donations?.length || 0,
        donations: donations || undefined,
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const getNearbyRequests = async (req, res, next) => {
  try {
    const validation = validateNearbyRequestsQuery(req.query);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    const viewerLocation = parseViewerLocation(req.query);
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
      const requestPayload = buildRequestPayload(entry.request, req.user?.role === 'donor' ? null : viewerLocation);
      return {
        ...requestPayload,
        ...(entry.score !== undefined ? { score: entry.score } : {}),
        ...(entry.locationScore !== undefined ? { locationScore: entry.locationScore } : {}),
        ...(entry.compatibility ? { compatibility: entry.compatibility } : {}),
        ...(entry.distanceKm !== undefined ? { distanceKm: entry.distanceKm } : {}),
      };
    });

    const paginated = formatted.slice(offset, offset + limit);

    return response.success(res, 200, 'Nearby requests retrieved successfully', {
      requests: paginated,
      pagination: paginationMeta(formatted.length, page, limit),
      viewerLocation,
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : null,
    });
  } catch (error) {
    next(error);
  }
};

export const getRequestGoogleMaps = async (req, res, next) => {
  try {
    const validation = validateRequestIdParam(req.params);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return response.error(res, 400, 'Invalid request id');
    }

    const request = await populateRequest(Request.findById(id));
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    const coordinates = getRequestCoordinates(request);
    if (!coordinates) {
      return response.error(res, 404, 'Request location is not available');
    }

    return response.success(res, 200, 'Request location retrieved successfully', {
      requestId: request._id.toString(),
      location: {
        lat: coordinates.latitude,
        lng: coordinates.longitude,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const acceptRequest = async (req, res, next) => {
  try {
    const validation = validateRequestIdParam(req.params);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    if (req.user.role !== 'donor') {
      return response.error(res, 403, 'Access denied - donor role required');
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return response.error(res, 400, 'Invalid request id');
    }

    const request = await populateRequest(Request.findById(id));
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    const donor = await Donor.findById(req.user.userId);
    if (!donor) {
      return response.error(res, 404, 'Donor not found');
    }

    await normalizeRequestIfExpired(request);

    // Guard: use the centralized state machine to validate pending -> accepted.
    // This also catches expired, completed, cancelled, and any other terminal states.
    try {
      validateTransition('request', request.status, 'accepted');
    } catch (err) {
      return response.error(res, 400, err.message);
    }

    if (request.acceptedBy) {
      return response.error(res, 400, 'Request has already been accepted');
    }

    const existingDonation = await Donation.findOne({
      donorId: donor._id,
      requestId: request._id,
      status: { $nin: ['cancelled', 'rejected'] },
    });

    if (existingDonation) {
      return response.error(res, 400, 'You have already responded to this request');
    }

    const eligibility = await donationService.validateEligibility(donor, request);
    if (!eligibility.eligible) {
      return response.error(res, 400, eligibility.reason || ELIGIBILITY_KEYS.DONOR_NOT_ELIGIBLE);
    }

    const donation = await Donation.create({
      donorId: donor._id,
      requestId: request._id,
      quantity: request.unitsNeeded ?? request.quantity ?? 1,
      status: 'pending',
    });

    request.status = 'accepted';
    request.acceptedBy = donor._id;
    request.acceptedByName = donor.fullName || null;
    request.acceptedByPhoneNumber = donor.phoneNumber || null;
    request.acceptedByBloodType = donor.bloodType || null;
    request.acceptedAt = new Date();
    request.acceptedDonationId = donation._id;
    await request.save();

    try {
      validateOrphanState('request', request, { donation });
    } catch (err) {
      await Donation.findByIdAndDelete(donation._id);
      return response.error(res, 400, err.message);
    }

    await Notification.create({
      userId: request.hospitalId._id,
      type: request.isEmergency || request.urgency === 'critical' ? 'emergency' : 'request',
      title: 'Request accepted',
      message: `${donor.fullName || 'A donor'} accepted the request for ${formatBloodTypeLabel(request.bloodType) || request.patientType || 'needed supplies'}.`,
      relatedId: request._id,
      relatedType: 'Request',
      data: {
        requestId: request._id,
        donorId: donor._id,
        donorName: donor.fullName || null,
        donorBloodType: donor.bloodType || null,
        status: request.status,
      },
    }).catch(() => {});

    return response.success(res, 200, 'Request accepted successfully', {
      request: getRequestSummary(request),
      donor: {
        id: donor._id,
        name: donor.fullName || null,
        phoneNumber: donor.phoneNumber || null,
        bloodType: donor.bloodType || null,
      },
      donation,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelRequest = async (req, res, next) => {
  try {
    const validation = validateRequestIdParam(req.params);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return response.error(res, 400, 'Invalid request id');
    }

    const request = await populateRequest(Request.findById(id));
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    await normalizeRequestIfExpired(request);

    // Guard: terminal requests cannot be cancelled in normal user-facing flows.
    try {
      validateTransition('request', request.status, 'cancelled');
    } catch (err) {
      return response.error(res, 400, err.message);
    }

    if (req.user.role === 'donor') {
      if (request.acceptedBy?.toString?.() !== req.user.userId) {
        return response.error(res, 403, 'You can only cancel your own accepted request');
      }

      const donor = await Donor.findById(req.user.userId);
      const donation = await Donation.findOne({
        donorId: req.user.userId,
        requestId: request._id,
        status: { $nin: ['cancelled', 'rejected'] },
      });

      const cancellation = await rejectDonationLifecycle({
        donationId: donation?._id || request.acceptedDonationId,
        requestId: request._id,
        donorId: req.user.userId,
        donationStatus: 'cancelled',
        // When a donor cancels their accepted request, we treat the whole
        // request as cancelled rather than reverting it to pending.
        requestStatus: 'cancelled',
        reason: 'Donation cancelled by donor',
      });

      return response.success(res, 200, 'Request cancelled successfully', {
        request: getRequestSummary(cancellation.request),
        donor: donor
          ? {
              id: donor._id,
              name: donor.fullName || null,
              phoneNumber: donor.phoneNumber || null,
              bloodType: donor.bloodType || null,
            }
          : null,
      });
    }

    if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
      return response.error(res, 403, 'Unauthorized');
    }

    if (req.user.role === 'hospital' && request.hospitalId?._id?.toString?.() !== req.user.userId) {
      return response.error(res, 403, 'Unauthorized access to this request');
    }

    const activeDonations = await Donation.find({ requestId: request._id, status: { $in: ['pending', 'scheduled'] } });
    for (const donation of activeDonations) {
      validateTransition('donation', donation.status, 'cancelled');
      donation.status = 'cancelled';
      await donation.save();
    }

    request.status = 'cancelled';
    request.cancelledAt = new Date();
    await request.save();
    await appointmentService.cancelActiveAppointmentsForRequest(request._id, {
      cancelledAt: request.cancelledAt,
      notes: 'Appointment cancelled because the linked request was cancelled',
    });

    return response.success(res, 200, 'Request cancelled successfully', {
      request: getRequestSummary(request),
    });
  } catch (error) {
    next(error);
  }
};

export const rejectRequest = async (req, res, next) => {
  try {
    const validation = validateRequestIdParam(req.params);
    if (!validation.valid) {
      return response.error(res, 400, validation.errors[0]);
    }

    if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
      return response.error(res, 403, 'Unauthorized');
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return response.error(res, 400, 'Invalid request id');
    }

    const request = await populateRequest(Request.findById(id));
    if (!request) {
      return response.error(res, 404, 'Request not found');
    }

    await normalizeRequestIfExpired(request);

    if (req.user.role === 'hospital' && request.hospitalId?._id?.toString?.() !== req.user.userId) {
      return response.error(res, 403, 'Unauthorized access to this request');
    }

    if (!request.acceptedDonationId && !request.acceptedBy) {
      return response.error(res, 400, 'Request has no accepted donation to reject');
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
  } catch (error) {
    next(error);
  }
};
