import { describe, it, beforeAll, afterEach, afterAll, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { connect, clearDatabase, closeDatabase } from '../helpers/db.js';
import { createHospital } from '../helpers/factories.js';

beforeAll(async () => {
  await connect();
}, 30_000);

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Hospital Auth Routes', () => {
  it('returns 200 for valid hospital login', async () => {
    const hospital = await createHospital();
    const res = await request(app)
      .post('/auth/hospital/login')
      .send({ email: hospital.email, password: 'TestPass@123', hospitalId: hospital.hospitalId });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('returns 401 for invalid hospitalId', async () => {
    const hospital = await createHospital();
    const res = await request(app)
      .post('/auth/hospital/login')
      .send({ email: hospital.email, password: 'TestPass@123', hospitalId: 'BAD-ID' });
    expect([400, 401]).toContain(res.status);
  });

  it('returns 400 for missing hospitalId', async () => {
    const hospital = await createHospital();
    const res = await request(app)
      .post('/auth/hospital/login')
      .send({ email: hospital.email, password: 'TestPass@123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed payload (missing email)', async () => {
    const res = await request(app)
      .post('/auth/hospital/login')
      .send({ password: 'whatever', hospitalId: 'HOSP-TEST-1' });
    expect(res.status).toBe(400);
  });
});
