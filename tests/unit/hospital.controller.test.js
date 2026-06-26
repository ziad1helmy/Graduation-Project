import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import * as hospitalController from '../../src/controllers/hospital.controller.js';
import Hospital from '../../src/models/Hospital.model.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';
import HospitalSettings from '../../src/models/HospitalSettings.model.js';
import * as matchingService from '../../src/services/matching.service.js';
import * as notificationService from '../../src/services/notification.service.js';
import * as adminService from '../../src/services/admin.service.js';
import * as hospitalService from '../../src/services/hospital.service.js';
import { makeMockReq, makeMockRes } from '../helpers/mocks.js';
import Appointment from '../../src/models/Appointment.model.js';
import { HttpError } from '../../src/utils/HttpError.js';

const expectHttpError = (next, statusCode, messagePattern) => {
  expect(next).toHaveBeenCalledTimes(1);
  const err = next.mock.calls[0][0];
  expect(err).toBeInstanceOf(HttpError);
  expect(err.statusCode).toBe(statusCode);
  if (messagePattern) expect(err.message).toMatch(messagePattern);
};

vi.mock('../../src/models/Hospital.model.js', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('../../src/models/Request.model.js', () => ({
  default: {
    create: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../src/models/Donation.model.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../src/models/HospitalSettings.model.js', () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../src/services/matching.service.js', () => ({
  searchCompatibleDonors: vi.fn(),
  findCompatibleDonors: vi.fn(),
}));

vi.mock('../../src/services/notification.service.js', () => ({
  notifyRequest: vi.fn(),
}));

vi.mock('../../src/services/admin.service.js', () => ({
  getBloodInventorySummary: vi.fn(),
}));

vi.mock('../../src/services/hospital.service.js', () => ({
  createHospitalByAdmin: vi.fn(),
}));

vi.mock('../../src/services/appointment.service.js', () => ({
  cancelActiveAppointmentsForRequest: vi.fn().mockResolvedValue({}),
  bookAppointment: vi.fn(),
}));

vi.mock('../../src/models/Appointment.model.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

describe('Hospital Controller', () => {
  const hospitalId = '507f1f77bcf86cd799439011';
  const requestId = '507f1f77bcf86cd799439022';

  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock mongoose.startSession to avoid real transactions in unit tests
    vi.spyOn(mongoose, 'startSession').mockResolvedValue({
      withTransaction: async (cb) => { await cb(); },
      endSession: () => {},
    });
  });

  describe('getProfile', () => {
    it('returns 200 and hospital details when profile is found', async () => {
      const req = makeMockReq({ user: { userId: hospitalId, role: 'hospital' } });
      const res = makeMockRes();
      const next = vi.fn();

      const mockHospital = {
        _id: hospitalId,
        hospitalName: 'General Hospital',
        fullName: 'General Hospital',
        department: 'Emergency',
        phone: '+1 (555) 987-6543',
        email: 'test@hospital.com',
        address: '123 Medical Center Dr, City',
        workingHoursStart: 8,
        workingHoursEnd: 19,
        slotsPerHour: 8,
        select: vi.fn().mockReturnThis(),
      };
      Hospital.findById.mockReturnValue(mockHospital);
      HospitalSettings.findOne.mockResolvedValue(null);

      await hospitalController.getProfile(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.data.hospitalName).toBe('General Hospital');
      expect(body.data.workingHours).toEqual({ openingHour: 8, closingHour: 19, slotsPerHour: 8 });
      expect(body.data.notifications.pushNotifications).toBe(true);
      expect(body.data.statistics).toHaveProperty('totalRequests');
    });

    it('returns 404 when hospital profile is not found', async () => {
      const req = makeMockReq({ user: { userId: hospitalId, role: 'hospital' } });
      const res = makeMockRes();
      const next = vi.fn();

      Hospital.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      await hospitalController.getProfile(req, res, next);

      expectHttpError(next, 404);
    });
  });

  describe('findDonors', () => {
    it('returns 200 and search results', async () => {
      const req = makeMockReq({
        user: { userId: hospitalId, role: 'hospital' },
        query: { bloodType: 'O+', radiusKm: '10', lat: '30.0', lng: '31.2' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockDonors = [
        {
          donor: { _id: 'donor123', fullName: 'Jane Doe', bloodType: 'O+', isOptedIn: true },
          distanceKm: 2.5,
        },
      ];
      matchingService.searchCompatibleDonors.mockResolvedValue(mockDonors);

      await hospitalController.findDonors(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data.donors).toHaveLength(1);
      expect(callArgs.data.donors[0].fullName).toBe('Jane Doe');
    });

    it('returns 400 for invalid bloodType', async () => {
      const req = makeMockReq({
        user: { userId: hospitalId, role: 'hospital' },
        query: { bloodType: 'INVALID' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await hospitalController.findDonors(req, res, next);

      expectHttpError(next, 400, /Invalid blood type/);
    });
  });

  describe('updateProfile', () => {
    it('returns 200 and success message', async () => {
      const req = makeMockReq({
        user: { userId: hospitalId, role: 'hospital' },
        body: { hospitalName: 'Updated Name', phone: '+1 (555) 987-6543' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockHospital = {
        _id: hospitalId,
        hospitalName: 'Old Name',
        phone: null,
        department: null,
        fullName: 'Old Name',
        email: 'test@hospital.com',
        address: null,
        save: vi.fn().mockResolvedValue(true),
      };
      Hospital.findById.mockResolvedValue(mockHospital);

      await hospitalController.updateProfile(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].message).toBe('hospital.profile_updated_success');
    });
  });

  describe('createRequest', () => {
    it('creates request and notifies compatible donors if emergency', async () => {
      const requiredByFuture = new Date();
      requiredByFuture.setDate(requiredByFuture.getDate() + 2);

      const req = makeMockReq({
        user: { userId: hospitalId, role: 'hospital' },
        body: {
          type: 'blood',
          bloodTypes: ['A+', 'O-'],
          urgency: 'critical',
          requiredBy: requiredByFuture.toISOString(),
          unitsNeeded: 3,
          isEmergency: true,
        },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockHospital = {
        _id: hospitalId,
        phone: '01000000000',
        location: { coordinates: { lat: 30, lng: 31 } },
        hospitalName: 'General Hospital',
      };
      Hospital.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockHospital),
      });

      const mockCreatedRequest = {
        _id: requestId,
        type: 'blood',
        bloodType: ['A+', 'O-'],
        urgency: 'critical',
        unitsNeeded: 3,
        isEmergency: true,
        populate: vi.fn().mockResolvedValue({}),
      };
      Request.create.mockResolvedValue([mockCreatedRequest]);

      matchingService.findCompatibleDonors.mockResolvedValue([{ donor: { _id: 'donor999' } }]);
      notificationService.notifyRequest.mockResolvedValue(true);

      await hospitalController.createRequest(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(Request.create).toHaveBeenCalled();
      expect(matchingService.findCompatibleDonors).toHaveBeenCalledWith(requestId);
      expect(notificationService.notifyRequest).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getRequests', () => {
    it('returns hospital requests', async () => {
      const req = makeMockReq({
        user: { userId: hospitalId, role: 'hospital' },
        query: { status: 'pending' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockRequests = [{ _id: requestId, type: 'blood', status: 'pending' }];
      Request.find.mockReturnValue({
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue(mockRequests),
      });
      Request.countDocuments.mockResolvedValue(1);

      await hospitalController.getRequests(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.requests).toHaveLength(1);
    });
  });

  describe('getAppointmentDetails', () => {
    it('returns 200 and includes donor info when appointment belongs to hospital', async () => {
      const req = makeMockReq({ user: { userId: hospitalId, role: 'hospital' }, params: { appointmentId: '507f1f77bcf86cd799439033' } });
      const res = makeMockRes();
      const next = vi.fn();

      const appointmentMock = {
        _id: '507f1f77bcf86cd799439033',
        donorId: { _id: 'donor1', fullName: 'Jane Doe', phoneNumber: '+201234567890', bloodType: 'O+' },
        hospitalId: { _id: hospitalId },
        appointmentDate: new Date().toISOString(),
        status: 'confirmed',
        donorDetails: { fullName: 'Jane Doe', phoneNumber: '+201234567890', bloodType: 'O+' },
        populate: vi.fn().mockResolvedValue(true),
        toObject: vi.fn().mockReturnValue({
          _id: '507f1f77bcf86cd799439033',
          donorId: { _id: 'donor1', fullName: 'Jane Doe', phoneNumber: '+201234567890', bloodType: 'O+' },
          donorDetails: { fullName: 'Jane Doe', phoneNumber: '+201234567890', bloodType: 'O+' },
          appointmentDate: new Date().toISOString(),
          status: 'confirmed',
        }),
      };

      Appointment.findOne.mockResolvedValue(appointmentMock);

      await hospitalController.getAppointmentDetails(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data.appointment).toBeDefined();
      expect(callArgs.data.donorDetails).toBeDefined();
      expect(callArgs.data.donorDetails.fullName).toBe('Jane Doe');
    });

    it('returns 404 when appointment not found', async () => {
      const req = makeMockReq({ user: { userId: hospitalId, role: 'hospital' }, params: { appointmentId: '507f1f77bcf86cd799439044' } });
      const res = makeMockRes();
      const next = vi.fn();

      Appointment.findOne.mockResolvedValue(null);

      await hospitalController.getAppointmentDetails(req, res, next);

      expectHttpError(next, 404, /error_not_found/);
    });
  });
});
