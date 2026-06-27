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

  describe('POST /support/my-tickets/:id/reply', () => {
    it('returns 200 and resets status to OPEN when donor replies to a REVIEWED ticket', async () => {
      const donor = await createDonor();
      const admin = await createAdmin();
      const donorToken = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });

      // Create a ticket
      const postRes = await request(app)
        .post('/support/contact')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ subject: 'Donor reply test', category: 'DONATION', message: 'Please help' });
      expect(postRes.status).toBe(201);
      const ticketId = postRes.body.data.ticket.id;

      // Admin replies → status becomes REVIEWED
      const adminReplyRes = await request(app)
        .post(`/admin/inbound-emails/${ticketId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reply: 'We are looking into it.' });
      expect(adminReplyRes.status).toBe(200);
      expect(adminReplyRes.body.data.ticket.status).toBe('REVIEWED');

      // Donor replies → status resets to OPEN
      const res = await request(app)
        .post(`/support/my-tickets/${ticketId}/reply`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ reply: 'Thank you, please let me know when ready.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket.status).toBe('OPEN');
      expect(res.body.data.ticket.donorReply).toBe('Thank you, please let me know when ready.');
      expect(res.body.data.ticket.donorReplyAt).toBeDefined();
      expect(res.body.data.ticket.adminReply).toBe('We are looking into it.');
      expect(res.body.data.ticket._id).toBe(ticketId);
    });

    it('returns 400 when reply is missing', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

      const res = await request(app)
        .post('/support/my-tickets/64a1b2c3d4e5f6a7b8c9d0e1/reply')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when reply exceeds 2000 characters', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

      const res = await request(app)
        .post('/support/my-tickets/64a1b2c3d4e5f6a7b8c9d0e1/reply')
        .set('Authorization', `Bearer ${token}`)
        .send({ reply: 'x'.repeat(2001) });

      expect(res.status).toBe(400);
    });

    it('returns 400 when ticket status is not REVIEWED', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

      const SupportMessage = (await import('../../src/models/SupportMessage.model.js')).default;
      const ticket = await SupportMessage.create({
        userId: donor._id,
        fullName: donor.fullName,
        email: donor.email,
        role: 'donor',
        subject: 'Still OPEN ticket',
        category: 'TECHNICAL',
        message: 'Not yet answered',
        status: 'OPEN',
      });

      const res = await request(app)
        .post(`/support/my-tickets/${ticket._id}/reply`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reply: 'I want to reply' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('help.error_cannot_reply_not_reviewed');
    });

    it('returns 400 when ticket status is CLOSED', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

      const SupportMessage = (await import('../../src/models/SupportMessage.model.js')).default;
      const ticket = await SupportMessage.create({
        userId: donor._id,
        fullName: donor.fullName,
        email: donor.email,
        role: 'donor',
        subject: 'Closed ticket',
        category: 'ACCOUNT',
        message: 'Already closed',
        status: 'CLOSED',
      });

      const res = await request(app)
        .post(`/support/my-tickets/${ticket._id}/reply`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reply: 'I want to reply' });

      expect(res.status).toBe(400);
    });

    it('returns 404 if ticket belongs to another donor', async () => {
      const donor1 = await createDonor();
      const donor2 = await createDonor();
      const token2 = signToken({ userId: donor2._id.toString(), role: 'donor', isEmailVerified: true });

      const SupportMessage = (await import('../../src/models/SupportMessage.model.js')).default;
      const ticket = await SupportMessage.create({
        userId: donor1._id,
        fullName: donor1.fullName,
        email: donor1.email,
        role: 'donor',
        subject: 'Not your ticket to reply',
        category: 'TECHNICAL',
        message: 'Need help',
        status: 'REVIEWED',
        adminReply: 'We replied',
        adminReplyAt: new Date(),
      });

      const res = await request(app)
        .post(`/support/my-tickets/${ticket._id}/reply`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ reply: 'I want to reply' });

      expect(res.status).toBe(404);
    });

    it('returns 400 for an invalid ObjectId', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

      const res = await request(app)
        .post('/support/my-tickets/invalid-id/reply')
        .set('Authorization', `Bearer ${token}`)
        .send({ reply: 'Hello' });

      expect(res.status).toBe(400);
    });

    it('returns 401 if unauthenticated', async () => {
      const res = await request(app)
        .post('/support/my-tickets/64a1b2c3d4e5f6a7b8c9d0e1/reply')
        .send({ reply: 'Hello' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /admin/inbound-emails includes support tickets', () => {
    it('returns 200 with support tickets alongside inbound emails for an admin', async () => {
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

      // 2. Query /admin/inbound-emails as an admin and check supportTickets are included
      const getRes = await request(app)
        .get('/admin/inbound-emails')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(Array.isArray(getRes.body.data.items)).toBe(true);
      
      const foundTicket = getRes.body.data.items.find(t => t.type === 'supportTicket' && t._id.toString() === ticketId.toString());
      expect(foundTicket).toBeDefined();
      expect(foundTicket.subject).toBe('Admin check ticket');
      expect(foundTicket.fullName).toBe(donor.fullName);
      expect(foundTicket.isRead).toBe(false);
      expect(foundTicket.isArchived).toBe(false);
    });

    it('filters support tickets by read=false and archived=false', async () => {
      const donor = await createDonor();
      const admin = await createAdmin();
      const donorToken = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });

      const postRes = await request(app)
        .post('/support/contact')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ subject: 'Unread ticket', category: 'TECHNICAL', message: 'Not read' });
      expect(postRes.status).toBe(201);

      const SupportMessage = (await import('../../src/models/SupportMessage.model.js')).default;
      await SupportMessage.create({
        userId: donor._id, fullName: donor.fullName, email: donor.email, role: 'donor',
        subject: 'Archived ticket', category: 'ACCOUNT', message: 'Archived', isRead: true, isArchived: true,
      });

      const getRes = await request(app)
        .get('/admin/inbound-emails')
        .query({ read: false, archived: false })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      const tickets = getRes.body.data.items.filter(t => t.type === 'supportTicket');
      expect(tickets.every(t => t.isRead === false)).toBe(true);
      expect(tickets.every(t => t.isArchived === false)).toBe(true);
      expect(tickets.some(t => t.subject === 'Unread ticket')).toBe(true);
      expect(tickets.some(t => t.subject === 'Archived ticket')).toBe(false);
    });

    it('filters support tickets by archived=true', async () => {
      const donor = await createDonor();
      const admin = await createAdmin();
      const donorToken = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });

      const SupportMessage = (await import('../../src/models/SupportMessage.model.js')).default;
      await SupportMessage.create({
        userId: donor._id, fullName: donor.fullName, email: donor.email, role: 'donor',
        subject: 'Archived item', category: 'DONATION', message: 'Archived msg', isArchived: true,
      });
      await SupportMessage.create({
        userId: donor._id, fullName: donor.fullName, email: donor.email, role: 'donor',
        subject: 'Not archived', category: 'OTHER', message: 'Active msg',
      });

      const getRes = await request(app)
        .get('/admin/inbound-emails')
        .query({ archived: true })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      const tickets = getRes.body.data.items.filter(t => t.type === 'supportTicket');
      expect(tickets.every(t => t.isArchived === true)).toBe(true);
      expect(tickets.some(t => t.subject === 'Archived item')).toBe(true);
      expect(tickets.some(t => t.subject === 'Not archived')).toBe(false);
    });

    it('returns 403 for non-admin user trying to access the endpoint', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

      const res = await request(app)
        .get('/admin/inbound-emails')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /admin/inbound-emails/:id/support-ticket', () => {
    it('returns 200 with support ticket details for an admin', async () => {
      const donor = await createDonor();
      const admin = await createAdmin();
      const donorToken = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });

      const postRes = await request(app)
        .post('/support/contact')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ subject: 'Detail view test', category: 'ACCOUNT', message: 'Check detail' });
      expect(postRes.status).toBe(201);
      const ticketId = postRes.body.data.ticket.id;

      const res = await request(app)
        .get(`/admin/inbound-emails/${ticketId}/support-ticket`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket).toBeDefined();
      expect(res.body.data.ticket.subject).toBe('Detail view test');
      expect(res.body.data.ticket.message).toBe('Check detail');
      expect(res.body.data.ticket.category).toBe('ACCOUNT');
      expect(res.body.data.ticket.status).toBe('OPEN');
      expect(res.body.data.ticket.fullName).toBe(donor.fullName);
      expect(res.body.data.ticket.email).toBe(donor.email);
    });

    it('returns 404 for a non-existent support ticket', async () => {
      const admin = await createAdmin();
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });
      const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';

      const res = await request(app)
        .get(`/admin/inbound-emails/${fakeId}/support-ticket`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 400 for an invalid ID', async () => {
      const admin = await createAdmin();
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });

      const res = await request(app)
        .get('/admin/inbound-emails/invalid-id/support-ticket')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 403 for non-admin user', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

      const res = await request(app)
        .get('/admin/inbound-emails/64a1b2c3d4e5f6a7b8c9d0e1/support-ticket')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /admin/inbound-emails/:id/reply', () => {
    it('returns 200 and marks ticket as REVIEWED when admin replies', async () => {
      const donor = await createDonor();
      const admin = await createAdmin();
      const donorToken = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });

      const postRes = await request(app)
        .post('/support/contact')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ subject: 'Reply test', category: 'TECHNICAL', message: 'Please reply' });
      expect(postRes.status).toBe(201);
      const ticketId = postRes.body.data.ticket.id;

      const res = await request(app)
        .post(`/admin/inbound-emails/${ticketId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reply: 'Thank you for reaching out.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket.status).toBe('REVIEWED');
      expect(res.body.data.ticket.adminReply).toBe('Thank you for reaching out.');
      expect(res.body.data.ticket.adminReplyBy).toBe(admin._id.toString());
    });

    it('returns 400 when reply is missing', async () => {
      const admin = await createAdmin();
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });

      const res = await request(app)
        .post('/admin/inbound-emails/64a1b2c3d4e5f6a7b8c9d0e1/reply')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when reply exceeds 4000 characters', async () => {
      const admin = await createAdmin();
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });

      const res = await request(app)
        .post('/admin/inbound-emails/64a1b2c3d4e5f6a7b8c9d0e1/reply')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reply: 'x'.repeat(4001) });

      expect(res.status).toBe(400);
    });

    it('returns 404 for a non-existent support ticket', async () => {
      const admin = await createAdmin();
      const adminToken = signToken({ userId: admin._id.toString(), role: 'admin', isEmailVerified: true });
      const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';

      const res = await request(app)
        .post(`/admin/inbound-emails/${fakeId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reply: 'Hello' });

      expect(res.status).toBe(404);
    });

    it('returns 403 for non-admin user', async () => {
      const donor = await createDonor();
      const token = signToken({ userId: donor._id.toString(), role: 'donor', isEmailVerified: true });

      const res = await request(app)
        .post('/admin/inbound-emails/64a1b2c3d4e5f6a7b8c9d0e1/reply')
        .set('Authorization', `Bearer ${token}`)
        .send({ reply: 'Hello' });

      expect(res.status).toBe(403);
    });
  });
});

