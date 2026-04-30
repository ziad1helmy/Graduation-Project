import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { connect, clearDatabase, closeDatabase } from '../helpers/db.js';
import User from '../../src/models/User.model.js';

// Mock mailer at top of file to prevent real SMTP calls
vi.mock('../../src/utils/mailer.js', () => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendEmail: vi.fn().mockResolvedValue(true),
}));

beforeAll(async () => {
  await connect();
}, 30_000);

afterEach(async () => {
  await clearDatabase();
  vi.clearAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Auth Smoke E2E Flow', () => {
  it('executes the full auth lifecycle (register -> verify -> login -> me -> logout)', async () => {
    const testEmail = 'newdonor@example.com';
    const testPassword = 'Password123!';

    // 1. POST /auth/register
    let res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        role: 'donor',
        fullName: 'New Donor',
        phoneNumber: '01011112222',
        bloodType: 'A+',
        gender: 'male',
        dateOfBirth: '1990-01-01',
        location: {
          city: 'Cairo',
          governorate: 'Cairo'
        }
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.data).toBeDefined();

    // 2. Bypass email verification
    const user = await User.findOne({ email: testEmail });
    expect(user).not.toBeNull();
    await User.findByIdAndUpdate(user._id, { isEmailVerified: true });
    
    // 3. POST /auth/login
    res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });
    
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    
    const accessToken = res.body.data.accessToken;
    const refreshToken = res.body.data.refreshToken;

    // 4. GET /auth/me
    res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(testEmail);

    // 5. POST /auth/logout
    res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    
    expect(res.status).toBe(200);
  });
});
