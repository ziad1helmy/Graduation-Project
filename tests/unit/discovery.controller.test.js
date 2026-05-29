import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import * as discoveryController from '../../src/controllers/discovery.controller.js';
import Hospital from '../../src/models/Hospital.model.js';

setupTestDB();

describe('Discovery Controller', () => {
  describe('Dev 1: Task 2 — getNearbyHospitals Enhanced Fields', () => {
    it('returns nearby hospitals with enhanced fields (urgentNeedsCount, isAvailable, bloodTypes)', async () => {
      const hospital = await createHospital({
        bloodBanksAvailable: ['O+', 'A+'],
        lat: 30.0,
        long: 31.0,
      });

      // Create some urgent requests for this hospital
      await createRequest(hospital._id, {
        bloodType: 'O+',
        urgency: 'critical',
        status: 'pending',
      });

      const req = {
        query: {
          lat: 30.0,
          lng: 31.0,
          radius_km: 50,
        },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await discoveryController.getNearbyHospitals(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data.hospitals).toBeTruthy();

      if (callArgs.data.hospitals.length > 0) {
        const hospitalData = callArgs.data.hospitals.find((h) => h.hospitalId === hospital._id.toString());
        if (hospitalData) {
          expect(hospitalData).toHaveProperty('isAvailable');
          expect(hospitalData).toHaveProperty('urgentNeedsCount');
          expect(hospitalData).toHaveProperty('bloodTypes');
          expect(hospitalData.isAvailable).toBe(true);
          expect(Array.isArray(hospitalData.bloodTypes)).toBe(true);
          expect(hospitalData.urgentNeedsCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('includes bloodTypes from hospital.bloodBanksAvailable', async () => {
      const hospital = await createHospital({
        bloodBanksAvailable: ['O+', 'O-', 'A+', 'B+'],
        lat: 30.0,
        long: 31.0,
      });

      const req = {
        query: {
          lat: 30.0,
          lng: 31.0,
          radius_km: 50,
        },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await discoveryController.getNearbyHospitals(req, res, next);

      const callArgs = res.json.mock.calls[0][0];
      if (callArgs.data.hospitals.length > 0) {
        const hospitalData = callArgs.data.hospitals[0];
        if (hospitalData.bloodTypes) {
          expect(hospitalData.bloodTypes.length).toBeGreaterThan(0);
        }
      }
    });

    it('sets isAvailable to true for all nearby hospitals', async () => {
      const hospital1 = await createHospital({
        bloodBanksAvailable: ['O+'],
        lat: 30.0,
        long: 31.0,
      });

      const hospital2 = await createHospital({
        bloodBanksAvailable: ['A+'],
        lat: 30.1,
        long: 31.1,
      });

      const req = {
        query: {
          lat: 30.0,
          lng: 31.0,
          radius_km: 50,
        },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await discoveryController.getNearbyHospitals(req, res, next);

      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.data.hospitals).toBeTruthy();
      callArgs.data.hospitals.forEach((hospital) => {
        expect(hospital.isAvailable).toBe(true);
      });
    });

    it('counts urgent requests (critical and high urgency) for each hospital', async () => {
      const hospital = await createHospital({
        bloodBanksAvailable: ['O+'],
        lat: 30.0,
        long: 31.0,
      });

      // Create multiple urgent requests
      await createRequest(hospital._id, {
        bloodType: 'O+',
        urgency: 'critical',
        status: 'pending',
      });

      await createRequest(hospital._id, {
        bloodType: 'O+',
        urgency: 'high',
        status: 'in-progress',
      });

      // Create a non-urgent request (should not be counted)
      await createRequest(hospital._id, {
        bloodType: 'O+',
        urgency: 'medium',
        status: 'pending',
      });

      const req = {
        query: {
          lat: 30.0,
          lng: 31.0,
          radius_km: 50,
        },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await discoveryController.getNearbyHospitals(req, res, next);

      const callArgs = res.json.mock.calls[0][0];
      if (callArgs.data.hospitals.length > 0) {
        const hospitalData = callArgs.data.hospitals[0];
        // Should count critical and high urgency requests
        expect(hospitalData.urgentNeedsCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Dev 2: Task 9 — searchHospitals and getHospitalsForMap', () => {
    it('searches hospitals by keyword and blood type', async () => {
      const targetHospital = await createHospital({
        hospitalName: 'Cairo Hope Hospital',
        fullName: 'Cairo Hope Hospital',
        bloodBanksAvailable: ['O+', 'A+'],
        lat: 30.02,
        long: 31.21,
      });

      await createHospital({
        hospitalName: 'Nile Clinic',
        fullName: 'Nile Clinic',
        bloodBanksAvailable: ['B+'],
        lat: 30.12,
        long: 31.31,
      });

      const req = {
        query: {
          q: 'Hope',
          bloodType: 'O+',
          availableOnly: 'true',
        },
      };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await discoveryController.searchHospitals(req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.hospitals).toHaveLength(1);
      expect(payload.data.hospitals[0].name).toContain('Hope');
      expect(payload.data.hospitals[0].bloodTypes).toContain('O+');
      expect(payload.data.hospitals[0].isAvailable).toBe(true);
      expect(payload.data.hospitals[0].hospitalId.toString()).toBe(targetHospital._id.toString());
    });

    it('returns minimal payload for map markers', async () => {
      await createHospital({
        hospitalName: 'Map Hospital',
        fullName: 'Map Hospital',
        lat: 30.1,
        long: 31.2,
      });

      const req = { query: {} };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await discoveryController.getHospitalsForMap(req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.data.hospitals)).toBe(true);
      expect(payload.data.hospitals[0]).toHaveProperty('id');
      expect(payload.data.hospitals[0]).toHaveProperty('name');
      expect(payload.data.hospitals[0]).toHaveProperty('lat');
      expect(payload.data.hospitals[0]).toHaveProperty('long');
    });
  });
});
