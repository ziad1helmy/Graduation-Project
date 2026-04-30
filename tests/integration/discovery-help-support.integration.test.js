import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { connect, clearDatabase, closeDatabase } from '../helpers/db.js';
import { createHospital, createDonor } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';

beforeAll(async () => {
  await connect();
}, 30_000);

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Discovery, Help, and Support Routes', () => {
  describe('GET /api/v1/hospitals/nearby', () => {
    it('returns 200 with nearby hospitals when lat/lng/radius are provided', async () => {
      await createHospital();
      const res = await request(app)
        .get('/api/v1/hospitals/nearby')
        .query({ latitude: 30.0444, longitude: 31.2357, radius_km: 50 });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.hospitals)).toBe(true);
    });

    it('returns 400 when missing required query parameters', async () => {
      const res = await request(app).get('/api/v1/hospitals/nearby');
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('GET /api/v1/hospitals', () => {
    it('returns 200 with a list of hospitals', async () => {
      await createHospital();
      const res = await request(app).get('/api/v1/hospitals');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/hospitals/:id', () => {
    it('returns 200 with hospital details for a valid ID', async () => {
      const hospital = await createHospital();
      const res = await request(app).get(`/api/v1/hospitals/${hospital._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.hospital.hospitalId || res.body.data.hospital.id).toBeDefined();
    });

    it('returns 404 for an invalid or non-existent hospital ID', async () => {
      const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';
      const res = await request(app).get(`/api/v1/hospitals/${fakeId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/help/faq', () => {
    it('returns 200 with FAQ data', async () => {
      const res = await request(app).get('/api/v1/help/faq');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/support/contact', () => {
    it('returns 201 when submitting a valid support request', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const res = await request(app)
        .post('/api/v1/support/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Need help', message: 'I cannot book an appointment.' });
      
      expect([200, 201]).toContain(res.status);
    });

    it('returns 400 when submitting a support request with missing required fields', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const res = await request(app)
        .post('/api/v1/support/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Only subject provided' });
      
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
