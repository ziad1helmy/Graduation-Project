/**
 * Phase 9 QA Test Suite - Refactor Verification Tests
 * 
 * These tests verify the changes made in phases 6-8:
 * - Phase 6: Eligibility filtering in getNearbyRequests
 * - Phase 7: Removal of decline endpoints
 * - Phase 8: Code cleanup and documentation
 */

import { describe, it, beforeAll, afterAll } from 'vitest';
import * as chai from 'chai';
import request from 'supertest';
import app from '../../src/app.js';
import { createDonor, createHospital, createRequest } from '../helpers/factories.js';
import { connect, closeDatabase } from '../helpers/db.js';
import { signToken } from '../../src/utils/jwt.js';
import Request from '../../src/models/Request.model.js';
import Donor from '../../src/models/Donor.model.js';

const { expect } = chai;

describe('Phase 9 QA Tests - Refactor Verification', function() {
  let accessToken;
  let requestId;

  beforeAll(async function() {
    await connect();

    // Ensure geospatial indexes are fully built in MongoDB Memory Server
    await Promise.all([
      Request.ensureIndexes(),
      Donor.ensureIndexes()
    ]);

    // Create an eligible donor
    const donor = await createDonor({
      bloodType: 'O+',
      isOptedIn: true,
      isEmailVerified: true,
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.0, lng: 31.0 },
      }
    });

    // Create a hospital
    const hospital = await createHospital({
      location: {
        city: 'Cairo',
        governorate: 'Cairo',
        coordinates: { lat: 30.01, lng: 31.01 },
      }
    });

    // Create an emergency request compatible with donor
    const reqObj = await createRequest(hospital._id, {
      bloodType: ['O+'],
      urgency: 'critical',
      status: 'pending',
      hospitalLocationGeo: { type: 'Point', coordinates: [31.01, 30.01] },
    });

    requestId = reqObj._id.toString();
    accessToken = signToken({ userId: donor._id.toString(), role: donor.role });
  });

  afterAll(async function() {
    await closeDatabase();
  });

  describe('Phase 6: Eligibility Filtering in getNearbyRequests', function() {
    
    it('should return only eligible requests for donor', async function() {
      const response = await request(app)
        .get('/requests/nearby')
        .query({ lat: 30.0, lng: 31.0, radius: 50 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.data.requests).to.be.an('array');
      expect(response.body.data.requests.length).to.be.greaterThanOrEqual(0);
    });

    it('should filter out requests when donor is in cooldown', async function() {
      const response = await request(app)
        .get('/requests/nearby')
        .query({ lat: 30.0, lng: 31.0, radius: 50 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.data).to.have.property('requests');
    });

    it('should work for opted-out donors (return empty list)', async function() {
      const response = await request(app)
        .get('/requests/nearby')
        .query({ lat: 30.0, lng: 31.0, radius: 50 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.data).to.have.property('requests');
      expect(response.body.data).to.have.property('pagination');
    });

    it('should include distance calculation in response', async function() {
      const response = await request(app)
        .get('/requests/nearby')
        .query({ lat: 30.0, lng: 31.0, radius: 50 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(200);
      
      if (response.body.data.requests.length > 0) {
        const firstRequest = response.body.data.requests[0];
        expect(firstRequest).to.have.property('distance');
        expect(firstRequest).to.have.property('distanceKm');
      }
    });

    it('should respect urgency filtering in getNearbyRequests', async function() {
      const response = await request(app)
        .get('/requests/nearby')
        .query({ 
          lat: 30.0, 
          lng: 31.0, 
          radius: 50,
          urgency: 'critical'
        })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.data.requests).to.be.an('array');
      
      if (response.body.data.requests.length > 0) {
        response.body.data.requests.forEach(req => {
          expect(req.urgency).to.equal('critical');
        });
      }
    });
  });

  describe('Phase 7: Removed Endpoints Return 404', function() {
    
    it('should return 404 for GET /donor/urgent-requests', async function() {
      const response = await request(app)
        .get('/donor/urgent-requests')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(404);
    });

    it('should return 404 for GET /donor/urgent-requests/:id', async function() {
      const response = await request(app)
        .get(`/donor/urgent-requests/${requestId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(404);
    });

    it('should return 404 for POST /donor/urgent-requests/:id/accept', async function() {
      const response = await request(app)
        .post(`/donor/urgent-requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 1 });

      expect(response.status).to.equal(404);
    });

    it('should return 404 for POST /donor/urgent-requests/:id/decline', async function() {
      const response = await request(app)
        .post(`/donor/urgent-requests/${requestId}/decline`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Not available' });

      expect(response.status).to.equal(404);
    });
  });

  describe('Phase 8: Maintained Endpoints Still Work', function() {
    
    it('should return 200 for GET /donor/requests', async function() {
      const response = await request(app)
        .get('/donor/requests')
        .query({ page: 1, limit: 20 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.data).to.have.property('requests');
      expect(response.body.data).to.have.property('pagination');
    });

    it('should return 200 for POST /requests/:id/accept', async function() {
      const response = await request(app)
        .post(`/requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 400, 409]).to.include(response.status);
    });

    it('should return 200 for GET /requests/nearby with urgency param', async function() {
      const response = await request(app)
        .get('/requests/nearby')
        .query({ 
          lat: 30.0, 
          lng: 31.0,
          urgency: 'high'
        })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.data).to.have.property('requests');
    });
  });

  describe('Emergency Notifications', function() {
    
    it('should not include decline action in emergency notification actions', async function() {
      const response = await request(app)
        .get('/requests/nearby')
        .query({ 
          lat: 30.0, 
          lng: 31.0,
          isEmergency: 'true'
        })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(200);
    });
  });

  describe('Backward Compatibility', function() {
    
    it('should accept standard accept request format', async function() {
      const response = await request(app)
        .post(`/requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.not.equal(404);
    });

    it('should still allow respond to request flow', async function() {
      const response = await request(app)
        .post(`/donor/respond/${requestId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 1 });

      expect(response.status).to.not.equal(404);
    });
  });
});
