import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { connect, closeDatabase } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import OneTimeOtp from '../../src/models/OneTimeOtp.model.js';
import Notification from '../../src/models/Notification.model.js';
import Request from '../../src/models/Request.model.js';
import Donation from '../../src/models/Donation.model.js';

describe('QA failure scenarios and vulnerability checks', () => {
  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('1. Reset Password OTP Brute-force Vulnerability', () => {
    it('should show that reset password endpoint does not block reset requests after 5 failed attempts (bypassing verify-otp limits)', async () => {
      const donor = await createDonor();
      
      // Request password reset OTP
      await request(app)
        .post('/auth/forgot-password')
        .send({ email: donor.email });

      // Find the generated OTP in DB to know it exists
      const otpRecord = await OneTimeOtp.findOne({ email: donor.email, purpose: 'password_reset' });
      expect(otpRecord).toBeTruthy();

      // We call the POST /auth/reset-password endpoint 10 times with a bad OTP
      // If there was a check for 5 attempts, it would fail with "OTP attempts exceeded" or similar.
      // Instead, it will keep return "Invalid OTP" and incrementing attempts beyond 5.
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/auth/reset-password')
          .send({
            email: donor.email,
            otp: '000000', // incorrect OTP
            password: 'NewPassword@123',
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid OTP');
      }

      // Check DB record to verify that attempts went up to 10
      const updatedOtp = await OneTimeOtp.findById(otpRecord._id);
      expect(updatedOtp.attempts).toBe(10);
    });
  });

  describe('2. Email Verification OTP Brute-force Vulnerability', () => {
    it('should show that email verification OTP has no limit on the number of failed attempts', async () => {
      const donor = await createDonor({ isEmailVerified: false });
      
      // Request email verification OTP
      await request(app)
        .post('/auth/verify-email')
        .send({ email: donor.email });

      // Try 10 times with incorrect codes
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/auth/verify-email-otp')
          .send({
            email: donor.email,
            otp: '000000', // incorrect OTP
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid or expired verification code');
      }
    });
  });

  describe('3. Hospital Request Cancellation Leaves Donors Unnotified', () => {
    it('should demonstrate that when a hospital cancels a request, the linked donations are cancelled but donors receive no notifications', async () => {
      const hospital = await createHospital();
      const donor = await createDonor();
      const donorToken = signToken({ userId: donor._id.toString(), role: donor.role });
      const hospitalToken = signToken({ userId: hospital._id.toString(), role: hospital.role });

      // Create request and accept it
      const reqObj = await createRequest(hospital._id, { status: 'pending', unitsNeeded: 1 });
      
      const acceptResponse = await request(app)
        .post(`/donor/respond/${reqObj._id}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ quantity: 1 });
      expect(acceptResponse.status).toBe(201);

      const donationId = acceptResponse.body.data._id;

      // Hospital cancels the request
      const cancelResponse = await request(app)
        .post(`/requests/${reqObj._id}/cancel`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({ reason: 'Hospital needs change' });
      expect(cancelResponse.status).toBe(200);

      // Verify donation is cancelled
      const updatedDonation = await Donation.findById(donationId);
      expect(updatedDonation.status).toBe('cancelled');

      // Verify no notification was generated in the DB for the donor notifying them that the request/donation was cancelled
      // Note: We might see match notifications or others, but not a cancellation notification
      const donorNotifications = await Notification.find({
        userId: donor._id,
        type: 'request',
        title: 'Request cancelled',
      });
      
      expect(donorNotifications.length).toBe(0); // Proves the notification gap!
    });
  });
});
