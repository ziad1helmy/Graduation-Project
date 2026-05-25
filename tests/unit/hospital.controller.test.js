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
  },
}));

vi.mock('../../src/models/Donation.model.js', () => ({
  default: {
    find: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
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
        select: vi.fn().mockReturnThis(),
      };
      Hospital.findById.mockReturnValue(mockHospital);

      await hospitalController.getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.hospitalName).toBe('General Hospital');
    });

    it('returns 404 when hospital profile is not found', async () => {
      const req = makeMockReq({ user: { userId: hospitalId, role: 'hospital' } });
      const res = makeMockRes();
      const next = vi.fn();

      Hospital.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      await hospitalController.getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
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

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toBe('Invalid bloodType');
    });
  });

  describe('updateProfile', () => {
    it('returns 200 and updated hospital profile', async () => {
      const req = makeMockReq({
        user: { userId: hospitalId, role: 'hospital' },
        body: { hospitalName: 'Updated Name', contactNumber: '01000000000' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockHospital = {
        _id: hospitalId,
        hospitalName: 'Old Name',
        contactNumber: '01000000000',
        save: vi.fn().mockResolvedValue(true),
        toObject: vi.fn().mockReturnValue({
          _id: hospitalId,
          hospitalName: 'Updated Name',
          contactNumber: '01000000000',
        }),
      };
      Hospital.findById.mockResolvedValue(mockHospital);

      await hospitalController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.hospitalName).toBe('Updated Name');
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
          bloodType: 'A+',
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
        contactNumber: '01000000000',
        location: { coordinates: { lat: 30, lng: 31 } },
        hospitalName: 'General Hospital',
      };
      Hospital.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockHospital),
      });

      const mockCreatedRequest = {
        _id: requestId,
        type: 'blood',
        bloodType: 'A+',
        urgency: 'critical',
        unitsNeeded: 3,
        isEmergency: true,
        populate: vi.fn().mockResolvedValue({}),
      };
      Request.create.mockResolvedValue([mockCreatedRequest]);

      matchingService.findCompatibleDonors.mockResolvedValue([{ donor: { _id: 'donor999' } }]);
      notificationService.notifyRequest.mockResolvedValue(true);

      await hospitalController.createRequest(req, res, next);

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

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.requests).toHaveLength(1);
    });
  });

  describe('closeRequest', () => {
    it('sets status to completed', async () => {
      const req = makeMockReq({
        user: { userId: hospitalId, role: 'hospital' },
        params: { requestId },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockRequest = {
        _id: requestId,
        hospitalId: hospitalId,
        status: 'pending',
      };
      Request.findById.mockResolvedValue(mockRequest);
      Request.findByIdAndUpdate.mockResolvedValue({
        ...mockRequest,
        status: 'completed',
      });

      await hospitalController.closeRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.status).toBe('completed');
    });
  });
});
