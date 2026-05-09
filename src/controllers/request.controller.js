import crypto from 'crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import response from '../utils/response.js';
import Request from '../models/Request.model.js';
import Donation from '../models/Donation.model.js';
import Donor from '../models/Donor.model.js';
import Notification from '../models/Notification.model.js';
import * as donationService from '../services/donation.service.js';

const QR_TTL_MS = 2 * 60 * 60 * 1000;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const populateRequest = (query) => {
  return query.populate('hospitalId', 'fullName hospitalName address contactNumber location');
};

const normalizeRequestIfExpired = async (request) => {
  if (!request) return request;

  const qrExpired = request.qrExpiresAt && new Date() > new Date(request.qrExpiresAt);
  if (qrExpired && request.status === 'pending') {
    request.status = 'expired';
    await request.save({ validateBeforeSave: false });
  }

  return request;
};

const getRequestSummary = (request) => ({
  id: request._id,
  requestId: request._id,
  bloodType: request.bloodType || null,
  hospitalName: request.hospitalName || request.hospitalId?.hospitalName || request.hospitalId?.fullName || null,
  patientType: request.patientType || request.cause || null,
  contactNumber: request.contactNumber || request.hospitalContact || request.hospitalId?.contactNumber || null,
  unitsNeeded: request.unitsNeeded ?? request.quantity ?? 1,
  isEmergency: Boolean(request.isEmergency || request.urgency === 'critical'),
  createdAt: request.createdAt,
  status: request.status,
  locationHospital: request.locationHospital || null,
  qrToken: request.qrToken || null,
});

const canAccessRequest = (request, req) => {
  if (req.user.role === 'admin' || req.user.role === 'superadmin') return true;
  if (req.user.role === 'hospital') {
    return request.hospitalId?._id?.toString?.() === req.user.userId;
  }
  return false;
};

export const generateQr = async (req, res, next) => {
  try {
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

    const now = new Date();
    request.qrToken = crypto.randomBytes(32).toString('hex');
    request.qrCreatedAt = now;
    request.qrExpiresAt = new Date(now.getTime() + QR_TTL_MS);

    if (request.status === 'expired') {
      request.status = 'pending';
    }

    await request.save();

    const qrImage = await QRCode.toDataURL(request.qrToken, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
    });

    return response.success(res, 200, 'QR generated successfully', {
      success: true,
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
    if (!['hospital', 'admin', 'superadmin'].includes(req.user.role)) {
      return response.error(res, 403, 'Unauthorized');
    }

    const qrToken = req.body.qrToken || req.body.qrCode;
    if (!qrToken) {
      return response.error(res, 400, 'qrToken is required');
    }

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
    });
  } catch (error) {
    next(error);
  }
};

export const acceptRequest = async (req, res, next) => {
  try {
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