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

describe('Auth Integration', () => {
  it('registers and logs in a donor (service-level integration)', async () => {
    const email = 'int-alice@example.com';
    const password = 'IntSecret123!';
    const data = buildDonor({ email, password });

    const res = await authService.register(data);

    expect(res).toHaveProperty('accessToken');
    expect(res).toHaveProperty('refreshToken');
    expect(res).toHaveProperty('user');
    expect(res.user.email).toBe(email);

    // verify email then login
    const user = await Donor.findOne({ email });
    user.isEmailVerified = true;
    await user.save();

    const loginRes = await authService.login({ email, password });
    expect(loginRes).toHaveProperty('accessToken');
    expect(loginRes).toHaveProperty('refreshToken');
    expect(loginRes.user.email).toBe(email);
  });
});
