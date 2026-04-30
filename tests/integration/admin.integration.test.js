import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createAdmin, createDonor, createHospital } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';

setupTestDB();

describe('Admin Routes Integration', () => {
  it('GET /admin/profile returns admin profile', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data.user.role).toBe('admin');
  });

  it('GET /admin/profile requires admin role', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/admin/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('GET /admin/system/health returns system health status', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/system/health')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('status');
  });

  it('POST /admin/system/maintenance enables maintenance mode', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .post('/admin/system/maintenance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        message: 'System maintenance',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('message') || expect(response.body.data).toHaveProperty('status');
  });

  it('GET /admin/system/maintenance returns maintenance status', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/system/maintenance')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('enabled');
  });

  it('GET /admin/statistics returns statistics summary', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    await createDonor();
    await createHospital();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/statistics')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('users');
  });

  it('GET /admin/alerts returns alerts summary', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/alerts')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('GET /admin/blood-inventory-summary returns blood inventory data', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/blood-inventory-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('GET /admin/audit-logs returns audit logs', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('logs');
  });

  it('GET /admin/donors returns list of donors', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    await createDonor();
    await createDonor();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/donors')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('users');
    expect(Array.isArray(response.body.data.users)).toBe(true);
    expect(response.body.data.users.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /admin/hospitals returns list of hospitals', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    await createHospital();
    await createHospital();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/hospitals')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('users');
    expect(Array.isArray(response.body.data.users)).toBe(true);
  });

  it('GET /admin/admins returns list of admins', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/admins')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('users');
  });

  it('GET /admin/donors/:id returns donor details', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get(`/admin/donors/${donor._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data.user._id.toString()).toBe(donor._id.toString());
  });

  it('GET /admin/hospitals/:id returns hospital details', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const hospital = await createHospital();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get(`/admin/hospitals/${hospital._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data.user._id.toString()).toBe(hospital._id.toString());
  });

  it('GET /admin/admins/:id returns admin details', async () => {
    await clearDatabase();
    const admin1 = await createAdmin();
    const admin2 = await createAdmin();

    const token = signToken({ userId: admin1._id.toString(), role: admin1.role });

    const response = await request(app)
      .get(`/admin/admins/${admin2._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data.user._id.toString()).toBe(admin2._id.toString());
  });

  it('GET /admin/dashboard returns dashboard data', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('GET /admin routes require authentication', async () => {
    await clearDatabase();

    const response = await request(app).get('/admin/profile');

    expect(response.status).toBe(401);
  });

  it('GET /admin routes require admin role', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/admin/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });
});
