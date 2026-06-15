import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createAdmin, createDonor, createHospital } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import { getRewardsConfig } from '../../src/services/rewardsConfig.service.js';

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

  it('GET /admin/rewards/config returns the current rewards config', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/rewards/config')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('points');
    expect(response.body.data.points).toHaveProperty('bloodDonation');
  });

  it('PUT /admin/rewards/config updates the rewards config', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const nextConfig = {
      points: {
        bloodDonation: 250,
        emergencyResponse: 120,
        profileCompletion: 60,
        referral: 175,
        firstDonation: 150,
      },
      tiers: {
        bronze: 0,
        silver: 1000,
        gold: 2500,
        platinum: 5000,
      },
      tierBonuses: {
        silver: 75,
        gold: 175,
        platinum: 550,
      },
    };

    const updateResponse = await request(app)
      .put('/admin/rewards/config')
      .set('Authorization', `Bearer ${token}`)
      .send(nextConfig);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.points.bloodDonation).toBe(250);

    const persisted = await getRewardsConfig();
    expect(persisted.points.bloodDonation).toBe(250);
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
  });

  it('GET /admin routes require authentication', async () => {
    await clearDatabase();

    const response = await request(app).get('/admin/profile');

    expect(response.status).toBe(401);
  });

  it('POST /admin/donors/:id/ban bans a donor and blocks login with the reason', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor({ password: 'DonorPass@123' });

    const adminToken = signToken({ userId: admin._id.toString(), role: admin.role });

    const banResponse = await request(app)
      .post(`/admin/donors/${donor._id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Compliance violation' });

    expect(banResponse.status).toBe(200);
    expect(banResponse.body.success).toBe(true);
    expect(banResponse.body.data.donor.isSuspended).toBe(true);

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email: donor.email, password: 'DonorPass@123', role: 'donor' });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.success).toBe(false);
    expect(loginResponse.body.message).toContain('Compliance violation');
    expect(loginResponse.body.details?.reason).toBe('Compliance violation');
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
    expect(response.body.data.stats).toHaveProperty('aiInsights');
    expect(Array.isArray(response.body.data.stats.aiInsights)).toBe(true);
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
    expect(user).toHaveProperty('joinedAt');
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

  it('POST /admin/admins with accessLevel "Full Access" (Flutter English) creates superadmin', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const response = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Full Access Admin',
        email: 'full.access@lifelink.test',
        password: 'AdminPass@123',
        accessLevel: 'Full Access',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.admin.role).toBe('superadmin');
    expect(response.body.data.admin).toHaveProperty('adminKey');
  });

  it('POST /admin/admins with accessLevel "fullAccess" (camelCase) creates superadmin', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const response = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'CamelCase Admin',
        email: 'camel.case@lifelink.test',
        password: 'AdminPass@123',
        accessLevel: 'fullAccess',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.admin.role).toBe('superadmin');
  });

  it('POST /admin/admins with accessLevel "Limited Access" creates admin', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const response = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Limited Access Admin',
        email: 'limited.access@lifelink.test',
        password: 'AdminPass@123',
        accessLevel: 'Limited Access',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.admin.role).toBe('admin');
  });

  it('POST /admin/admins with accessLevel "View Only" creates admin (no view-only role exists)', async () => {
    await clearDatabase();
    const superadmin = await createAdmin({ role: 'superadmin' });

    const token = signToken({ userId: superadmin._id.toString(), role: superadmin.role });

    const response = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'View Only Admin',
        email: 'view.only@lifelink.test',
        password: 'AdminPass@123',
        accessLevel: 'View Only',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.admin.role).toBe('admin');
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
