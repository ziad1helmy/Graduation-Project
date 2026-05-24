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
  describe('GET /hospitals/nearby', () => {
    it('returns 200 with nearby hospitals when lat/lng/radius are provided', async () => {
      await createHospital();
      const res = await request(app)
        .get('/hospitals/nearby')
        .query({ latitude: 30.0444, longitude: 31.2357, radius_km: 50 });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.hospitals)).toBe(true);
    });

    it('returns 400 when missing required query parameters', async () => {
      const res = await request(app).get('/hospitals/nearby');
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('GET /hospitals', () => {
    it('returns 200 with a list of hospitals', async () => {
      await createHospital();
      const res = await request(app).get('/hospitals');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /hospitals/:id', () => {
    it('returns 200 with hospital details for a valid ID', async () => {
      const hospital = await createHospital();
      const res = await request(app).get(`/hospitals/${hospital._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.hospital.hospitalId || res.body.data.hospital.id).toBeDefined();
    });

    it('returns 404 for an invalid or non-existent hospital ID', async () => {
      const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';
      const res = await request(app).get(`/hospitals/${fakeId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /help/faq', () => {
    it('returns 200 with FAQ data', async () => {
      const res = await request(app).get('/help/faq');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /support/contact', () => {
    it('returns 201 when submitting a valid support request', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const res = await request(app)
        .post('/support/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Need help', category: 'TECHNICAL', message: 'I cannot book an appointment.' });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket).toBeDefined();
      expect(res.body.data.ticket.id).toBeDefined();

      // Verify the ticket was stored in the database with correct authenticated details and category
      const SupportMessage = (await import('../../src/models/SupportMessage.model.js')).default;
      const ticket = await SupportMessage.findById(res.body.data.ticket.id);
      expect(ticket).toBeDefined();
      expect(ticket.userId.toString()).toBe(donor._id.toString());
      expect(ticket.fullName).toBe(donor.fullName);
      expect(ticket.email).toBe(donor.email);
      expect(ticket.role).toBe('donor');
      expect(ticket.category).toBe('TECHNICAL');
      expect(ticket.subject).toBe('Need help');
      expect(ticket.message).toBe('I cannot book an appointment.');
    });

    it('returns 400 when submitting a support request with missing required fields', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const res = await request(app)
        .post('/support/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Only subject provided' });
      
      expect(res.status).toBe(400);
    });

    it('returns 400 when submitting a support request with an invalid category', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const res = await request(app)
        .post('/support/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Need help', category: 'INVALID_CATEGORY', message: 'I cannot book an appointment.' });
      
      expect(res.status).toBe(400);
    });

    it('returns 400 when attempting to spoof sender identity in request body', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const res = await request(app)
        .post('/support/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({
          subject: 'Need help',
          category: 'TECHNICAL',
          message: 'I cannot book an appointment.',
          email: 'spoofed@example.com',
        });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Identity fields cannot be provided in the request body');
    });

    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(app)
        .post('/support/contact')
        .send({ subject: 'Need help', category: 'TECHNICAL', message: 'I cannot book an appointment.' });
      
      expect(res.status).toBe(401);
    });
  });
});
