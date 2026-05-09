import crypto from 'crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import response from '../utils/response.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import Notification from '../models/Notification.model.js';
import * as donationService from '../services/donation.service.js';
import { calculateDistance } from '../utils/geo.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import {
  validateNearbyRequestsQuery,
  validateRequestIdParam,
  validateQrBody,
} from '../validation/request.validation.js';

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

const buildGoogleMapsUrl = (coordinates) => {
  if (!coordinates) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}`;
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

const buildRequestPayload = (request, viewerLocation = null, { donationCount = 0, donations = null } = {}) => {
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
    bloodType: request.bloodType || null,
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
    googleMapsUrl: buildGoogleMapsUrl(requestLocation),
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
    ...(donations ? { donations, donationCount } : {}),
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
      bloodType: request.bloodType || null,
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
        donationCount: donations?.length || 0,
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
    const radiusKm = req.query.radius === undefined || req.query.radius === '' ? null : Number(req.query.radius);
    const { page, limit, skip } = parsePagination(req.query, 20);

    const query = {
      status: { $in: ['pending', 'accepted'] },
    };

    if (req.query.bloodType) query.bloodType = req.query.bloodType;
    if (req.query.type) query.type = req.query.type;
    if (req.query.urgency) query.urgency = req.query.urgency;
    if (req.query.isEmergency === 'true' || req.query.isEmergency === '1') {
      query.isEmergency = true;
    }

    const requests = await populateRequest(
      Request.find(query).sort({ urgency: -1, createdAt: -1 }).limit(500)
    );

    const filtered = filterNearbyRequests(requests, viewerLocation, Number.isFinite(radiusKm) ? radiusKm : null);
    const paginated = filtered.slice(skip, skip + limit);

    return response.success(res, 200, 'Nearby requests retrieved successfully', {
      requests: paginated,
      pagination: paginationMeta(filtered.length, page, limit),
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

    return response.success(res, 200, 'Google Maps URL generated successfully', {
      requestId: request._id.toString(),
      googleMapsUrl: buildGoogleMapsUrl(coordinates),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
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
    if (request.status === 'expired') {
      return response.error(res, 400, 'Request has expired');
    }

    if (['accepted', 'completed', 'cancelled'].includes(request.status)) {
      return response.error(res, 400, 'Request is no longer available');
    }

    if (request.acceptedBy) {
      return response.error(res, 400, 'Request has already been accepted');
    }

    const existingDonation = await Donation.findOne({
      donorId: donor._id,
      requestId: request._id,
      status: { $ne: 'cancelled' },
    });

    if (existingDonation) {
      return response.error(res, 400, 'You have already responded to this request');
    }

    const eligibility = await donationService.validateEligibility(donor, request);
    if (!eligibility.eligible) {
      return response.error(res, 400, eligibility.reason || 'Donor is not eligible');
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

    await Notification.create({
      userId: request.hospitalId._id,
      type: request.isEmergency || request.urgency === 'critical' ? 'emergency' : 'request',
      title: 'Request accepted',
      message: `${donor.fullName || 'A donor'} accepted the request for ${request.bloodType || request.patientType || 'needed supplies'}.`,
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

    if (req.user.role === 'donor') {
      if (request.acceptedBy?.toString?.() !== req.user.userId) {
        return response.error(res, 403, 'You can only cancel your own accepted request');
      }

      const donor = await Donor.findById(req.user.userId);
      const donation = await Donation.findOne({
        donorId: req.user.userId,
        requestId: request._id,
        status: { $ne: 'cancelled' },
      });

      if (donation) {
        donation.status = 'cancelled';
        await donation.save();
      }

      request.status = 'cancelled';
      request.acceptedBy = null;
      request.acceptedByName = null;
      request.acceptedByPhoneNumber = null;
      request.acceptedByBloodType = null;
      request.acceptedAt = null;
      request.acceptedDonationId = null;
      request.cancelledAt = new Date();
      await request.save();

      return response.success(res, 200, 'Request cancelled successfully', {
        request: getRequestSummary(request),
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

    await Donation.updateMany(
      { requestId: request._id, status: { $ne: 'cancelled' } },
      { status: 'cancelled' }
    );

    request.status = 'cancelled';
    request.cancelledAt = new Date();
    await request.save();

    return response.success(res, 200, 'Request cancelled successfully', {
      request: getRequestSummary(request),
    });
  } catch (error) {
    next(error);
  }
};