import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createAdmin, createDonor, createHospital } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import RewardCatalog from '../../src/models/RewardCatalog.model.js';

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
    expect(response.body.data).toHaveProperty('admin');
    expect(response.body.data.admin.role).toBe('admin');
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

  it('GET /admin/rewards returns all rewards data (overview, catalog, adjustments)', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    // Seed a reward so catalog has data
    await RewardCatalog.create({ name: 'Test Reward', description: 'Test', pointsCost: 100, category: 'FOOD', status: 'ACTIVE' });

    const response = await request(app)
      .get('/admin/rewards')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('totalPoints');
    expect(response.body.data).toHaveProperty('percentageChange');
    expect(typeof response.body.data.totalPoints).toBe('number');
    expect(typeof response.body.data.percentageChange).toBe('number');
    expect(Array.isArray(response.body.data.tiers)).toBe(true);
    expect(response.body.data.tiers).toHaveLength(4);
    expect(response.body.data.tiers[0]).toHaveProperty('tierName');
    expect(response.body.data.tiers[0]).toHaveProperty('userCount');
    expect(response.body.data).toHaveProperty('topRedeemed');
    expect(Array.isArray(response.body.data.topRedeemed)).toBe(true);
    expect(response.body.data.catalog).toHaveProperty('items');
    expect(response.body.data.catalog).toHaveProperty('totalCount');
    expect(response.body.data.catalog.items[0].rewardName).toBe('Test Reward');
    expect(Array.isArray(response.body.data.adjustments)).toBe(true);
  });

  it('GET /admin/rewards?query= finds users for points dropdown', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor({ email: 'testlookup@example.com' });
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/rewards?query=testlookup@example.com')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.users)).toBe(true);
    expect(response.body.data.users.length).toBeGreaterThanOrEqual(1);
    expect(response.body.data.users[0].email).toBe('testlookup@example.com');
  });

  it('POST /admin/rewards creates a new reward', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .post('/admin/rewards')
      .set('Authorization', `Bearer ${token}`)
      .send({ rewardName: 'New Reward', category: 'FOOD', pointsRequired: 500, status: 'ACTIVE' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.rewardName).toBe('New Reward');
    expect(response.body.data.pointsRequired).toBe(500);
  });

  it('POST /admin/rewards updates reward status via { id, status }', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });
    const reward = await RewardCatalog.create({ name: 'Test', description: 'Test', pointsCost: 100, category: 'FOOD', status: 'ACTIVE' });

    const response = await request(app)
      .post('/admin/rewards')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: reward._id.toString(), status: 'INACTIVE' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('INACTIVE');
  });

  it('POST /admin/rewards adjusts points via { userId, amount, reason }', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .post('/admin/rewards')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: donor._id.toString(), amount: 100, reason: 'Test adjustment' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.newBalance).toBe(100);
  });

  it('POST /admin/rewards bulk updates reward points via { updates: [...] }', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });
    const r1 = await RewardCatalog.create({ name: 'R1', description: 'D1', pointsCost: 100, category: 'FOOD', status: 'ACTIVE' });
    const r2 = await RewardCatalog.create({ name: 'R2', description: 'D2', pointsCost: 200, category: 'HEALTH', status: 'ACTIVE' });

    const response = await request(app)
      .post('/admin/rewards')
      .set('Authorization', `Bearer ${token}`)
      .send({
        updates: [
          { id: r1._id.toString(), pointsRequired: 150 },
          { id: r2._id.toString(), pointsRequired: 250 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.updated).toHaveLength(2);
  });

  it('POST /admin/rewards with invalid body returns 400', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .post('/admin/rewards')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
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
    expect(response.body.data).toHaveProperty('alerts');
    expect(response.body.data.alerts).toHaveProperty('criticalAlerts');
    expect(Array.isArray(response.body.data.alerts.criticalAlerts)).toBe(true);
    expect(response.body.data.alerts).toHaveProperty('criticalRequests');
    expect(response.body.data.alerts).toHaveProperty('shortageAlerts');
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

  it('GET /admin/donors returns list of donors with pagination and stats', async () => {
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
    expect(response.body.data).toHaveProperty('pagination');
    expect(response.body.data).toHaveProperty('stats');
  });

  it('GET /admin/hospitals returns list of hospitals with pagination and stats', async () => {
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
    expect(response.body.data).toHaveProperty('pagination');
    expect(response.body.data).toHaveProperty('stats');
  });

  it('GET /admin/admins returns list with adminKey for API-created admins', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    // Create admin via API so adminKey is encrypted and stored
    await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Key Visible Admin',
        email: 'key.visible@lifelink.test',
        password: 'AdminPass@123',
        accessLevel: 'Limited Access',
      });

    const response = await request(app)
      .get('/admin/admins')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('admins');
    // API-created admin should have adminKey visible
    const apiAdmin = response.body.data.admins.find(
      (a) => a.email === 'key.visible@lifelink.test'
    );
    expect(apiAdmin).toBeDefined();
    expect(apiAdmin).toHaveProperty('adminKey');
    expect(typeof apiAdmin.adminKey).toBe('string');
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
    expect(response.body.data.user).toHaveProperty('bloodType');
    expect(response.body.data.user.bloodType).toBe(donor.bloodType);
    expect(response.body.data.user).toHaveProperty('phone');
    expect(response.body.data.user.phone).toBe(donor.phoneNumber);
    expect(response.body.data.user).toHaveProperty('phoneNumber');
    expect(response.body.data.user.phoneNumber).toBe(donor.phoneNumber);
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
    expect(response.body.data.user.contactNumber).toBe(hospital.contactNumber);
    expect(response.body.data.user.phone).toBeNull();
  });

  it('GET /admin/admins/:id returns admin details with adminKey', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    // Create admin via API so adminKey is encrypted
    const created = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Detail Check Admin',
        email: 'detail.check@lifelink.test',
        password: 'AdminPass@123',
        accessLevel: 'Limited Access',
      });

    expect(created.status).toBe(201);
    const adminId = created.body.data.admin._id;

    const response = await request(app)
      .get(`/admin/admins/${adminId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data.user._id).toBe(adminId);
    expect(response.body.data.user).toHaveProperty('adminKey');
    expect(typeof response.body.data.user.adminKey).toBe('string');
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
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('totalDonors');
    expect(response.body.data).toHaveProperty('totalDonorsGrowth');
    expect(response.body.data).toHaveProperty('activeRequests');
    expect(response.body.data).toHaveProperty('activeRequestsGrowth');
    expect(response.body.data).toHaveProperty('criticalCases');
    expect(response.body.data).toHaveProperty('criticalCasesGrowth');
    expect(response.body.data).toHaveProperty('successfulDonations');
    expect(response.body.data).toHaveProperty('successfulDonationsGrowth');
    expect(response.body.data).toHaveProperty('weeklyTrends');
    expect(response.body.data).toHaveProperty('criticalAlerts');
    expect(response.body.data).toHaveProperty('bloodTypeDistribution');
    expect(response.body.data).toHaveProperty('topDonors');
    expect(response.body.data).toHaveProperty('aiInsights');
  });

  it('GET /admin routes require authentication', async () => {
    await clearDatabase();

    const response = await request(app).get('/admin/profile');

    expect(response.status).toBe(401);
  });

  it('POST /admin/users/:id/ban bans a donor and blocks login with the reason', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor({ password: 'DonorPass@123' });

    const adminToken = signToken({ userId: admin._id.toString(), role: admin.role });

    const banResponse = await request(app)
      .post(`/admin/users/${donor._id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Compliance violation' });

    expect(banResponse.status).toBe(200);
    expect(banResponse.body.success).toBe(true);
    expect(banResponse.body.data.user.isSuspended).toBe(true);

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email: donor.email, password: 'DonorPass@123', role: 'donor' });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.success).toBe(false);
    expect(loginResponse.body.message).toContain('Compliance violation');
    expect(loginResponse.body.details?.reason).toBe('Compliance violation');
  });

  it('POST /admin/users/:id/ban bans a hospital', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const hospital = await createHospital({ password: 'HospitalPass@123' });

    const adminToken = signToken({ userId: admin._id.toString(), role: admin.role });

    const banResponse = await request(app)
      .post(`/admin/users/${hospital._id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Policy violation' });

    expect(banResponse.status).toBe(200);
    expect(banResponse.body.success).toBe(true);
    expect(banResponse.body.data.user.isSuspended).toBe(true);
    expect(banResponse.body.data.user.suspendedReason).toBe('Policy violation');
  });

  it('POST /admin/users/:id/ban bans an admin when caller is superadmin', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });
    const targetAdmin = await createAdmin();

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const banResponse = await request(app)
      .post(`/admin/users/${targetAdmin._id}/ban`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Abuse of privileges' });

    expect(banResponse.status).toBe(200);
    expect(banResponse.body.success).toBe(true);
    expect(banResponse.body.data.user.isSuspended).toBe(true);
  });

  it('POST /admin/users/:id/ban rejects banning an admin by non-superadmin', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const targetAdmin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const banResponse = await request(app)
      .post(`/admin/users/${targetAdmin._id}/ban`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Abuse of privileges' });

    expect(banResponse.status).toBe(403);
    expect(banResponse.body.success).toBe(false);
    expect(banResponse.body.message).toContain('Only superadmin can ban admin accounts');
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

  it('GET /admin/users returns users, pagination and global stats', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    await createDonor();
    await createHospital();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('users');
    expect(response.body.data).toHaveProperty('pagination');
    expect(response.body.data).toHaveProperty('stats');
    expect(response.body.data.pagination).toHaveProperty('total');
    expect(response.body.data.pagination).toHaveProperty('totalPages');
    expect(response.body.data.pagination).toHaveProperty('hasNextPage');
    expect(response.body.data.pagination).toHaveProperty('hasPrevPage');
    expect(response.body.data.stats).toHaveProperty('totalUsers');
    expect(response.body.data.stats).toHaveProperty('totalDonors');
    expect(response.body.data.stats).toHaveProperty('totalHospitals');
    expect(response.body.data.stats).toHaveProperty('totalAdmins');
    expect(response.body.data.stats).toHaveProperty('verifiedUsers');
    expect(response.body.data.stats).toHaveProperty('unverifiedUsers');
    expect(response.body.data.stats).toHaveProperty('suspendedUsers');
    expect(response.body.data.stats).toHaveProperty('totalUsersGrowth');
  });

  it('GET /admin/users includes id alias and donor enrichment fields', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/users?role=donor')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const user = response.body.data.users[0];
    expect(user).toHaveProperty('id');
    expect(user.id).toBe(user._id.toString());
    expect(user).toHaveProperty('totalDonations');
    expect(user).toHaveProperty('completedDonations');
    expect(user).toHaveProperty('pointsBalance');
    expect(user).toHaveProperty('lifetimePointsEarned');
    expect(user).toHaveProperty('tier');
    expect(user).toHaveProperty('eligibilitySummary');
    expect(user).toHaveProperty('isActive');
    expect(user).toHaveProperty('isSuspended');
    expect(user).toHaveProperty('isVerified');
    expect(user).toHaveProperty('isEmailVerified');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('phone');
    expect(user).toHaveProperty('bloodType');
    expect(user.bloodType).toBe(donor.bloodType);
    expect(user).toHaveProperty('joinedAt');
  });

  it('GET /admin/users returns phone for admins and contactNumber for hospitals', async () => {
    await clearDatabase();
    const admin = await createAdmin({ phone: '01000000000' });
    const hospital = await createHospital({ contactNumber: '01011111111' });

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const adminUser = response.body.data.users.find((u) => u.role === 'admin');
    const hospitalUser = response.body.data.users.find((u) => u.role === 'hospital');
    expect(adminUser).toBeDefined();
    expect(adminUser.phone).toBe('01000000000');
    expect(hospitalUser).toBeDefined();
    expect(hospitalUser.contactNumber).toBe('01011111111');
    expect(hospitalUser.phone).toBeNull();
  });

  it('POST /admin/users/hospital with Flutter field names creates hospital', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .post('/admin/users/hospital')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Flutter Hospital',
        email: 'flutter@lifelink.test',
        password: 'TestPass@123',
        phone: '+20123456789',
        hospitalCode: 'HOSP-FLUTTER-001',
        latitude: 30.0444,
        longitude: 31.2357,
        type: 'General Hospital',
        emergencyContactNumber: '+20123456780',
        adminContactName: 'Dr. Test',
        adminContactPhone: '+20123456789',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.hospital.email).toBe('flutter@lifelink.test');
    expect(response.body.data.hospital.hospitalId).toBe('HOSP-FLUTTER-001');
  });

  it('POST /admin/users/hospital without optional fields (password, lat, long, hospitalCode) creates hospital with generated values', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .post('/admin/users/hospital')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Generated Hospital',
        email: 'generated.hosp@lifelink.test',
        phone: '+20123456789',
        type: 'General Hospital',
        emergencyContactNumber: '+20123456780',
        adminContactName: 'Dr. Test',
        adminContactPhone: '+20123456789',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.hospital.email).toBe('generated.hosp@lifelink.test');
    expect(response.body.data.hospital.hospitalId).toBeDefined();
    expect(response.body.data.hospital.hospitalId).toMatch(/^HOSP-[0-9A-F]{8}$/);
    expect(response.body.data.hospital.lat).toBeNull();
    expect(response.body.data.hospital.long).toBeNull();
  });

  it.each([
    { field: 'contactNumber', value: '+20123456789', code: 'HOSP-LEGACY-001', name: 'Legacy Contact Hospital', email: 'legacy.contact@lifelink.test' },
    { field: 'phone', value: '+20123456788', code: 'HOSP-PHONE-001', name: 'Phone Hospital', email: 'phone.hosp@lifelink.test' },
  ])('POST /admin/users/hospital with $field maps to contactNumber only', async ({ field, value, code, name, email }) => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .post('/admin/users/hospital')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        email,
        password: 'TestPass@123',
        [field]: value,
        hospitalCode: code,
        type: 'General Hospital',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.hospital.contactNumber).toBe(value);
    expect(response.body.data.hospital.phone).toBeNull();
  });

  it.each([
    { accessLevel: 'Full Access', expectedRole: 'superadmin', description: 'Flutter English' },
    { accessLevel: 'fullAccess', expectedRole: 'superadmin', description: 'camelCase' },
    { accessLevel: 'Limited Access', expectedRole: 'admin', description: 'English label' },
    { accessLevel: 'View Only', expectedRole: 'admin', description: 'falls back to admin' },
  ])('POST /admin/admins with accessLevel "$accessLevel" ($description) creates $expectedRole', async ({ accessLevel, expectedRole }) => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const response = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: `${accessLevel} Admin`,
        email: `${accessLevel.toLowerCase().replace(/\s+/g, '.')}@lifelink.test`,
        password: 'AdminPass@123',
        accessLevel,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.admin.role).toBe(expectedRole);
    if (expectedRole === 'superadmin') {
      expect(response.body.data.admin).toHaveProperty('adminKey');
    }
  });

  it('POST /admin/admins without accessLevel uses role field (backward compat)', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const response = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Role-based Admin',
        email: 'role.based@lifelink.test',
        password: 'AdminPass@123',
        role: 'admin',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.admin.role).toBe('admin');
    expect(response.body.data.admin).toHaveProperty('adminKey');
  });

  it('POST /admin/admins with phone creates admin and stores phone', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const response = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Phone Test Admin',
        email: 'phone.test@lifelink.test',
        password: 'AdminPass@123',
        phone: '+201234567890',
        address: '123 Test St',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.admin.phone).toBe('+201234567890');
    expect(response.body.data.admin.address).toBe('123 Test St');
  });

  it('POST /admin/admins with invalid phone type returns 400', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const response = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Invalid Phone Admin',
        email: 'invalid.phone@lifelink.test',
        password: 'AdminPass@123',
        phone: 12345,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('POST /admin/admins with invalid address type returns 400', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const response = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Invalid Address Admin',
        email: 'invalid.address@lifelink.test',
        password: 'AdminPass@123',
        address: 12345,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('GET /admin/requests returns requests list with combined stats and mapped fields', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const hospital = await createHospital();

    const { default: Request } = await import('../../src/models/Request.model.js');
    await Request.create({
      hospitalId: hospital._id,
      type: 'blood',
      bloodType: ['O+'],
      urgency: 'critical',
      status: 'pending',
      unitsNeeded: 3,
      requiredBy: new Date(Date.now() + 2 * 60 * 60 * 1000),
      hospitalContact: '01001112233',
      hospitalName: 'Test Hospital',
    });

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/requests')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('requests');
    expect(response.body.data).toHaveProperty('stats');
    expect(response.body.data.requests[0]).toHaveProperty('donorsContacted');
    expect(response.body.data.requests[0]).toHaveProperty('donorsConfirmed');
    expect(response.body.data.requests[0]).toHaveProperty('urgencyLevel');
    expect(response.body.data.requests[0].urgencyLevel).toBe('critical');
    expect(response.body.data.requests[0]).toHaveProperty('completionTimeInHours');
    expect(response.body.data.requests[0].completionTimeInHours).toBe(2);
    expect(typeof response.body.data.requests[0].location).toBe('string');
  });
});
