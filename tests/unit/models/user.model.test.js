import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../../helpers/db.js';
import User from '../../../src/models/User.model.js';

setupTestDB();

describe('User model', () => {
  it('hashes password on save', async () => {
    const u = await User.create({
      fullName: 'Hash Tester',
      email: `hash${Date.now()}@test.com`,
      password: 'Password123!',
    });

    // password field is select:false; fetch raw doc including password
    const fetched = await User.findById(u._id).select('+password');
    expect(fetched.password).toBeTruthy();
    expect(fetched.password).not.toBe('Password123!');
  });

  it('createPasswordResetToken sets token hash and expiry and returns token', async () => {
    const u = new User({
      fullName: 'Reset Tester',
      email: `reset${Date.now()}@test.com`,
      password: 'Password123!',
    });

    const token = u.createPasswordResetToken();
    expect(token).toHaveLength(64);
    expect(u.resetPasswordToken).toBeTruthy();
    expect(u.resetPasswordExpires).toBeTruthy();
  });

  it('createEmailVerificationToken sets token hash and expiry and returns token', async () => {
    const u = new User({
      fullName: 'Verify Tester',
      email: `verify${Date.now()}@test.com`,
      password: 'Password123!',
    });

    const token = u.createEmailVerificationToken();
    expect(token).toHaveLength(64);
    expect(u.emailVerificationToken).toBeTruthy();
    expect(u.emailVerificationExpires).toBeTruthy();
  });

  it('validates required fields and email format', async () => {
    await expect(User.create({ fullName: 'X', email: 'bademail', password: 'short' }))
      .rejects.toThrow();
  });
});
