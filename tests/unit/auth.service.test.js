import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { buildDonor } from '../helpers/factories.js';
import Donor from '../../src/models/Donor.model.js';
import * as authService from '../../src/services/auth.service.js';

vi.mock('../../src/utils/mailer.js', () => ({
  sendEmailVerificationEmail: vi.fn(),
  sendEmailVerificationConfirmationEmail: vi.fn(),
  sendPasswordResetOtpEmail: vi.fn(),
  sendPasswordResetConfirmationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
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
    // verification token is exposed in non-production environments
    expect(res).toHaveProperty('verificationToken');

    const user = await Donor.findOne({ email });
    expect(user).toBeTruthy();
  });

  it('allows login when email is verified', async () => {
    const email = 'bob@example.com';
    const password = 'Secret123!';
    const data = buildDonor({ email, password });

    // register then verify email to permit login
    await authService.register(data);
    const user = await Donor.findOne({ email });
    user.isEmailVerified = true;
    await user.save();

    const loginRes = await authService.login({ email, password });

    expect(loginRes).toHaveProperty('accessToken');
    expect(loginRes).toHaveProperty('refreshToken');
    expect(loginRes.user.email).toBe(email);
  });
});
