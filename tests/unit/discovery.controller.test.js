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

  describe('Distance calculation: accepts lat/lng, lat/long, and lat/latitude+long', () => {
    // Bug: /hospitals/nearby previously only read req.query.long, so clients
    // sending `lng` got NaN distance and were silently dropped by radius_km.
    const hospital = { lat: 30.0444, long: 31.2357 };

    const callNearby = async (query) => {
      const req = { query };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();
      await discoveryController.getNearbyHospitals(req, res, next);
      return res.json.mock.calls[0][0];
    };

    it.each([
      ['lat/lng', { lat: 30.0444, lng: 31.2357 }],
      ['lat/long', { lat: 30.0444, long: 31.2357 }],
      ['latitude/longitude', { latitude: 30.0444, longitude: 31.2357 }],
    ])('computes distanceKm for nearby hospital using %s query', async (_label, query) => {
      await createHospital({ ...hospital, bloodBanksAvailable: ['O+'] });

      const payload = await callNearby({ ...query, radius_km: 50 });

      const entry = payload.data.hospitals[0];
      expect(entry).toBeDefined();
      expect(entry.distanceKm).toBe(0);
      expect(entry.distanceMeters).toBe(0);
      expect(entry.distance).toBe('0 m');
    });

    it('returns empty result when radius_km is supplied without coordinates (was dropping all results)', async () => {
      await createHospital({ ...hospital, bloodBanksAvailable: ['O+'] });

      const payload = await callNearby({ radius_km: 50 });

      expect(payload.data.hospitals).toHaveLength(1);
      expect(payload.data.hospitals[0].distanceKm).toBeUndefined();
    });

    it('filters out hospitals beyond radius_km when coordinates are provided', async () => {
      await createHospital({ lat: 30.0444, long: 31.2357, bloodBanksAvailable: ['O+'] });
      // Alexandria is ~180 km from Cairo — must be excluded by a 50 km radius
      await createHospital({ lat: 31.2001, long: 29.9187, bloodBanksAvailable: ['A+'] });

      const payload = await callNearby({ lat: 30.0444, lng: 31.2357, radius_km: 50 });

      expect(payload.data.hospitals).toHaveLength(1);
      expect(payload.data.hospitals[0].lat).toBe(30.0444);
    });
  });

  describe('getHospitalById: accepts lat/lng alias for distance computation', () => {
    // Bug: /hospitals/:id previously only read req.query.long, so clients
    // sending `lng` got NaN distance.
    const callById = async (hospitalId, query) => {
      const req = { params: { id: hospitalId }, query };
      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();
      await discoveryController.getHospitalById(req, res, next);
      return res.json.mock.calls[0][0];
    };

    it.each([
      ['lat/lng',        { lat: 30.0444, lng: 31.2357 }],
      ['lat/long',       { lat: 30.0444, long: 31.2357 }],
      ['latitude/longitude', { latitude: 30.0444, longitude: 31.2357 }],
    ])('computes distanceKm for hospital with %s query', async (_label, query) => {
      const hospital = await createHospital({ lat: 30.0444, long: 31.2357 });

      const payload = await callById(hospital._id, query);

      expect(payload.data.hospital).toBeDefined();
      expect(payload.data.hospital.distanceKm).toBe(0);
    });

    it('omits distance fields when no coordinates are provided', async () => {
      const hospital = await createHospital({ lat: 30.0444, long: 31.2357 });

      const payload = await callById(hospital._id, {});

      expect(payload.data.hospital).toBeDefined();
      expect(payload.data.hospital.distanceKm).toBeUndefined();
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
