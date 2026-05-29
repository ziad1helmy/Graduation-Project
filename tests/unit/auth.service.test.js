import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { buildDonor } from '../helpers/factories.js';
import Donor from '../../src/models/Donor.model.js';
import * as authService from '../../src/services/auth.service.js';

vi.mock('../../src/utils/mailer.js', () => ({
  sendEmailVerificationEmail: vi.fn(() => Promise.resolve()),
  sendEmailVerificationConfirmationEmail: vi.fn(() => Promise.resolve()),
  sendPasswordResetOtpEmail: vi.fn(() => Promise.resolve()),
  sendPasswordResetConfirmationEmail: vi.fn(() => Promise.resolve()),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
}));

setupTestDB();

describe('Auth Service', () => {
  it('registers a donor and returns auth payload', async () => {
    const email = 'alice@example.com';
    const data = buildDonor({ email });

    const res = await authService.register(data);

    expect(res).toHaveProperty('accessToken');
    expect(res).toHaveProperty('refreshToken');
    expect(res).toHaveProperty('user');
    expect(res.user.email).toBe(email);
    expect(res).toHaveProperty('verificationEmail');

    const user = await Donor.findOne({ email });
    expect(user).toBeTruthy();
  });

  it('registers a donor with location coordinates', async () => {
    const email = 'dave@example.com';
    const data = buildDonor({
      email,
      location: { lat: 30.0444, lng: 31.2357 },
    });

    const res = await authService.register(data);

    expect(res.user).toBeDefined();
    expect(res.user.location).toBeDefined();
    expect(res.user.location.coordinates).toEqual({ lat: 30.0444, lng: 31.2357 });

    const user = await Donor.findOne({ email });
    expect(user.location?.coordinates).toEqual({ lat: 30.0444, lng: 31.2357 });
  });

  it('allows login when email is verified', async () => {
    const email = 'bob@example.com';
    const password = 'Secret123!';
    const data = buildDonor({ email, password, confirmPassword: password });

    // register then verify email to permit login
    await authService.register(data);
    const user = await Donor.findOne({ email });
    user.isEmailVerified = true;
    await user.save();

    const loginRes = await authService.login({ email, password, role: 'donor' });

    expect(loginRes).toHaveProperty('accessToken');
    expect(loginRes).toHaveProperty('refreshToken');
    expect(loginRes.user.email).toBe(email);
  });

  it('verifies email with an otp code', async () => {
    const email = 'carol@example.com';
    const password = 'Secret123!';
    const data = buildDonor({ email, password, confirmPassword: password });

    await authService.register(data);
    const user = await Donor.findOne({ email });
    const otp = user.createEmailVerificationOtp();
    await user.save({ validateBeforeSave: false });

    const res = await authService.verifyEmailOtp({ email, otp });

    expect(res).toEqual({ success: true });

    const updatedUser = await Donor.findOne({ email });
    expect(updatedUser.isEmailVerified).toBe(true);
    expect(updatedUser.emailVerifiedAt).toBeTruthy();
  });

  it('changes password after verifying the current password', async () => {
    const email = 'diana@example.com';
    const currentPassword = 'OldPass@123';
    const newPassword = 'NewPass@123';
    const data = buildDonor({ email, password: currentPassword, confirmPassword: currentPassword });

    await authService.register(data);
    const user = await Donor.findOne({ email });
    user.isEmailVerified = true;
    await user.save();

    const result = await authService.changePassword(user._id, {
      currentPassword,
      newPassword,
    });

    expect(result).toEqual({ success: true });

    const freshUser = await Donor.findOne({ email }).select('+password +passwordChangedAt');
    expect(freshUser.passwordChangedAt).toBeTruthy();

    await expect(authService.login({ email, password: currentPassword, role: 'donor' })).rejects.toThrow('Invalid credentials');

    const loginRes = await authService.login({ email, password: newPassword, role: 'donor' });
    expect(loginRes.user.email).toBe(email);
  });

  it('returns a 400 service error when the current password is incorrect', async () => {
    const email = 'eve@example.com';
    const currentPassword = 'OldPass@123';
    const newPassword = 'NewPass@123';
    const data = buildDonor({ email, password: currentPassword, confirmPassword: currentPassword });

    await authService.register(data);
    const user = await Donor.findOne({ email });
    user.isEmailVerified = true;
    await user.save();

    await expect(authService.changePassword(user._id, {
      currentPassword: 'WrongPass@123',
      newPassword,
    })).rejects.toMatchObject({
      message: 'Current password is incorrect',
      statusCode: 400,
    });
  });

  it('rejects reusing the current password', async () => {
    const email = 'frank@example.com';
    const password = 'SamePass@123';
    const data = buildDonor({ email, password, confirmPassword: password });

    await authService.register(data);
    const user = await Donor.findOne({ email });
    user.isEmailVerified = true;
    await user.save();

    await expect(authService.changePassword(user._id, {
      currentPassword: password,
      newPassword: password,
    })).rejects.toMatchObject({
      message: 'New password must be different from current password',
      statusCode: 400,
    });
  });
});
