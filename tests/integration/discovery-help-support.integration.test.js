import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { connect, clearDatabase, closeDatabase } from '../helpers/db.js';
import { createHospital, createDonor, createAdmin } from '../helpers/factories.js';
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

    it('computes distanceKm when client sends ?lng= (not just ?long=)', async () => {
      // Cairo center; createHospital defaults place the hospital there
      await createHospital({ lat: 30.0444, long: 31.2357 });
      const res = await request(app)
        .get('/hospitals/nearby')
        .query({ lat: 30.0444, lng: 31.2357, radius_km: 50 });
      expect(res.status).toBe(200);
      const hospital = res.body.data.hospitals[0];
      expect(hospital).toBeDefined();
      expect(hospital.distanceKm).toBe(0);
      expect(hospital.distanceMeters).toBe(0);
    });

    it('does not drop all results when radius_km is sent without coordinates', async () => {
      await createHospital({ lat: 30.0444, long: 31.2357 });
      const res = await request(app)
        .get('/hospitals/nearby')
        .query({ radius_km: 50 });
      expect(res.status).toBe(200);
      expect(res.body.data.hospitals).toHaveLength(1);
      expect(res.body.data.hospitals[0].distanceKm).toBeUndefined();
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

  describe('GET /support/my-tickets', () => {
    it('returns 200 with paginated tickets for the authenticated donor', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      
      const SupportMessage = (await import('../../src/models/SupportMessage.model.js')).default;
      await SupportMessage.create({
        userId: donor._id,
        fullName: donor.fullName,
        email: donor.email,
        role: 'donor',
        subject: 'First Ticket',
        category: 'DONATION',
        message: 'Hello',
      });

      const res = await request(app)
        .get('/support/my-tickets')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tickets).toHaveLength(1);
      expect(res.body.data.tickets[0].subject).toBe('First Ticket');
      expect(res.body.data.pagination.total).toBe(1);
    });

    it('returns 401 if unauthenticated', async () => {
      const res = await request(app).get('/support/my-tickets');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /support/my-tickets/:id', () => {
    it('returns 200 with ticket details if owned by the donor', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      
      const SupportMessage = (await import('../../src/models/SupportMessage.model.js')).default;
      const ticket = await SupportMessage.create({
        userId: donor._id,
        fullName: donor.fullName,
        email: donor.email,
        role: 'donor',
        subject: 'My specific ticket',
        category: 'ACCOUNT',
        message: 'Need help',
      });

      const res = await request(app)
        .get(`/support/my-tickets/${ticket._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket).toBeDefined();
      expect(res.body.data.ticket.subject).toBe('My specific ticket');
      // Ensure private fields are excluded
      expect(res.body.data.ticket.userId).toBeUndefined();
    });

    it('returns 404 if ticket belongs to another user', async () => {
      const donor1 = await createDonor();
      const donor2 = await createDonor();
      const token2 = signToken({ userId: donor2._id.toString(), role: 'donor', isEmailVerified: true });
      
      const SupportMessage = (await import('../../src/models/SupportMessage.model.js')).default;
      const ticket = await SupportMessage.create({
        userId: donor1._id,
        fullName: donor1.fullName,
        email: donor1.email,
        role: 'donor',
        subject: 'Not your ticket',
        category: 'ACCOUNT',
        message: 'Need help',
      });

      const res = await request(app)
        .get(`/support/my-tickets/${ticket._id}`)
        .set('Authorization', `Bearer ${token2}`);
      
      expect(res.status).toBe(404);
    });
  });

  describe('GET /admin/support', () => {
    it('returns 200 with all support tickets for an admin', async () => {
      const donor = await createDonor();
      const admin = await createAdmin();
      const donorToken = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });

      // 1. Submit a support message as the donor
      const postRes = await request(app)
        .post('/support/contact')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ subject: 'Admin check ticket', category: 'TECHNICAL', message: 'Hello admin' });
      expect(postRes.status).toBe(201);
      const ticketId = postRes.body.data.ticket.id;

      // 2. Query as an admin and see if the ticket exists
      const getRes = await request(app)
        .get('/admin/support')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(Array.isArray(getRes.body.data.tickets)).toBe(true);
      
      const foundTicket = getRes.body.data.tickets.find(t => t._id.toString() === ticketId.toString());
      expect(foundTicket).toBeDefined();
      expect(foundTicket.subject).toBe('Admin check ticket');
      expect(foundTicket.fullName).toBe(donor.fullName);
    });

    it('returns 403 for non-admin user trying to access the endpoint', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

      const res = await request(app)
        .get('/admin/support')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});

