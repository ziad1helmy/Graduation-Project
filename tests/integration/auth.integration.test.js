import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB } from '../helpers/db.js';
import { buildDonor, createDonor } from '../helpers/factories.js';
import Donor from '../../src/models/Donor.model.js';
import * as authService from '../../src/services/auth.service.js';
import { signToken } from '../../src/utils/jwt.js';

vi.mock('../../src/utils/mailer.js', () => ({
  sendEmailVerificationEmail: vi.fn(() => Promise.resolve()),
  sendEmailVerificationConfirmationEmail: vi.fn(() => Promise.resolve()),
  sendPasswordResetOtpEmail: vi.fn(() => Promise.resolve()),
  sendPasswordResetConfirmationEmail: vi.fn(() => Promise.resolve()),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
}));

setupTestDB();

describe('Auth Integration', () => {
  it('registers and logs in a donor (service-level integration)', async () => {
    const email = 'int-alice@example.com';
    const password = 'IntSecret123!';
    const data = buildDonor({ email, password, confirmPassword: password });

    const res = await authService.register(data);

    expect(res).toHaveProperty('accessToken');
    expect(res).toHaveProperty('refreshToken');
    expect(res).toHaveProperty('user');
    expect(res.user.email).toBe(email);

    // verify email then login
    const user = await Donor.findOne({ email });
    user.isEmailVerified = true;
    await user.save();

    const loginRes = await authService.login({ email, password, role: 'donor' });
    expect(loginRes).toHaveProperty('accessToken');
    expect(loginRes).toHaveProperty('refreshToken');
    expect(loginRes.user.email).toBe(email);
  });

  it('POST /auth/signup returns dateOfBirth as YYYY-MM-DD', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({
        role: 'donor',
        fullName: 'Date Format Donor',
        email: 'date-format-donor@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        phoneNumber: '01012345678',
        dateOfBirth: '1995-01-01',
        bloodType: 'O+',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.dateOfBirth).toBe('1995-01-01');
  });

  it('GET /auth/me returns dateOfBirth as YYYY-MM-DD for donors', async () => {
    const donor = await createDonor({ dateOfBirth: new Date('1994-04-12T00:00:00.000Z') });
    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dateOfBirth).toBe('1994-04-12');
  });

  describe('Banned donor auth', () => {
    it('POST /auth/login returns 403 with the admin ban reason for a banned donor', async () => {
      const password = 'BannedPass@123';
      const donor = await createDonor({
        password,
        isSuspended: true,
        suspendedReason: 'Violated community guidelines',
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: donor.email, password, role: 'donor' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Account banned');
      expect(res.body.message).toContain('Violated community guidelines');
      expect(res.body.details?.reason).toBe('Violated community guidelines');
    });

    it('POST /auth/signup returns 403 with the admin ban reason when email belongs to a banned donor', async () => {
      const donor = await createDonor({
        isSuspended: true,
        suspendedReason: 'Repeated no-shows',
      });

      const res = await request(app)
        .post('/auth/signup')
        .send({
          role: 'donor',
          fullName: 'New Signup',
          email: donor.email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
          phoneNumber: '01012345678',
          dateOfBirth: '1995-01-01',
          bloodType: 'O+',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Account banned');
      expect(res.body.message).toContain('Repeated no-shows');
      expect(res.body.details?.reason).toBe('Repeated no-shows');
    });
  });

  describe('POST /auth/change-password', () => {
    it('returns 400 when the current password is incorrect', async () => {
      const donor = await createDonor({ password: 'CorrectPass@123' });
      const token = signToken({ userId: donor._id.toString(), role: donor.role });

      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPass@123',
          newPassword: 'BrandNew@123',
          confirmPassword: 'BrandNew@123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Current password is incorrect');
    });

    it('returns 401 when the token is missing', async () => {
      const res = await request(app)
        .post('/auth/change-password')
        .send({
          currentPassword: 'CorrectPass@123',
          newPassword: 'BrandNew@123',
          confirmPassword: 'BrandNew@123',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authorization header is required');
    });

    it('returns 401 when the token is expired', async () => {
      const donor = await createDonor({ password: 'CorrectPass@123' });
      const expiredToken = signToken(
        { userId: donor._id.toString(), role: donor.role },
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          currentPassword: 'CorrectPass@123',
          newPassword: 'BrandNew@123',
          confirmPassword: 'BrandNew@123',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Token has expired');
    });

    it('returns 200 when the current password is correct', async () => {
      const donor = await createDonor({ password: 'CorrectPass@123' });
      const token = signToken({ userId: donor._id.toString(), role: donor.role });

      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'CorrectPass@123',
          newPassword: 'BrandNew@123',
          confirmPassword: 'BrandNew@123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password changed successfully');
    });

    it('returns 400 when the new password matches the current password', async () => {
      const donor = await createDonor({ password: 'SamePass@123' });
      const token = signToken({ userId: donor._id.toString(), role: donor.role });

      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'SamePass@123',
          newPassword: 'SamePass@123',
          confirmPassword: 'SamePass@123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.newPassword).toBe('newPassword must be different from currentPassword');
    });
  });
});
