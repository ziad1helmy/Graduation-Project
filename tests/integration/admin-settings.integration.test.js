import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createAdmin } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import SystemSettings from '../../src/models/SystemSettings.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import { encryptAdminKey } from '../../src/utils/admin-key-crypto.js';

setupTestDB();

describe('Admin System Settings & Health Integration', () => {
  it('GET /admin/system-settings returns profile, 4 new settings, and health', async () => {
    await clearDatabase();

    const adminId = new mongoose.Types.ObjectId();
    const encryptedKey = encryptAdminKey('ADM999', adminId.toString());
    const admin = await createAdmin({
      _id: adminId,
      position: 'Director of IT',
      department: 'Infrastructure',
      adminKey: encryptedKey,
    });

    await SystemSettings.create([
      { key: 'maintenance_mode', value: true, updatedBy: admin._id },
      { key: 'donor_registration_enabled', value: false, updatedBy: admin._id },
      { key: 'notifications_enabled', value: true, updatedBy: admin._id },
      { key: 'max_missed_donations_before_ban', value: 5, updatedBy: admin._id },
    ]);

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const adminData = response.body.data.admin;
    expect(adminData).toBeDefined();
    expect(adminData._id).toBe(admin._id.toString());
    expect(adminData.position).toBe('Director of IT');
    expect(adminData.department).toBe('Infrastructure');
    expect(adminData.adminAccessKey).toBe('ADM999');

    const settingsData = response.body.data.settings;
    expect(settingsData).toBeDefined();
    expect(settingsData.maintenanceModeEnabled).toBe(true);
    expect(settingsData.donorRegistrationEnabled).toBe(false);
    expect(settingsData.notificationsEnabled).toBe(true);
    expect(settingsData.maxMissedDonationsBeforeBan).toBe(5);
    expect(settingsData.emergencyAlertsEnabled).toBeUndefined();
    expect(settingsData.aiPredictionsEnabled).toBeUndefined();

    const healthData = response.body.data.systemHealth;
    expect(healthData).toBeDefined();
    expect(healthData.status).toBe('healthy');
    expect(healthData.uptime).toMatch(/^\d+d \d+h \d+m$/);
    expect(healthData.services).toHaveProperty('database', 'online');
    expect(healthData.memory).toMatch(/^\d+MB \/ \d+MB$/);
    expect(healthData.nodeVersion).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('GET /admin/system-settings returns defaults when no settings seeded', async () => {
    await clearDatabase();

    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const settings = response.body.data.settings;
    expect(settings.maintenanceModeEnabled).toBe(false);
    expect(settings.donorRegistrationEnabled).toBe(true);
    expect(settings.notificationsEnabled).toBe(true);
    expect(settings.maxMissedDonationsBeforeBan).toBe(3);
  });

  it('PUT /admin/system-settings updates all 4 new settings', async () => {
    await clearDatabase();

    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .put('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        maintenanceModeEnabled: true,
        donorRegistrationEnabled: false,
        notificationsEnabled: false,
        maxMissedDonationsBeforeBan: 7,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const settings = response.body.data.settings;
    expect(settings.maintenanceModeEnabled).toBe(true);
    expect(settings.donorRegistrationEnabled).toBe(false);
    expect(settings.notificationsEnabled).toBe(false);
    expect(settings.maxMissedDonationsBeforeBan).toBe(7);

    const maintenanceRecord = await SystemSettings.findOne({ key: 'maintenance_mode' });
    const donorRegRecord = await SystemSettings.findOne({ key: 'donor_registration_enabled' });
    const notifRecord = await SystemSettings.findOne({ key: 'notifications_enabled' });
    const maxMissedRecord = await SystemSettings.findOne({ key: 'max_missed_donations_before_ban' });

    expect(maintenanceRecord.value).toBe(true);
    expect(donorRegRecord.value).toBe(false);
    expect(notifRecord.value).toBe(false);
    expect(maxMissedRecord.value).toBe(7);
  });

  it('PUT /admin/system-settings with partial update only changes provided keys', async () => {
    await clearDatabase();

    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .put('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ donorRegistrationEnabled: false });

    expect(response.status).toBe(200);
    const settings = response.body.data.settings;
    expect(settings.donorRegistrationEnabled).toBe(false);
    expect(settings.maintenanceModeEnabled).toBe(false);
    expect(settings.notificationsEnabled).toBe(true);
    expect(settings.maxMissedDonationsBeforeBan).toBe(3);
  });

  it('PUT /admin/system-settings with invalid boolean field returns 400', async () => {
    await clearDatabase();

    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .put('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ donorRegistrationEnabled: 'yes' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('PUT /admin/system-settings with invalid number field returns 400', async () => {
    await clearDatabase();

    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .put('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ maxMissedDonationsBeforeBan: 0 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('PUT /admin/system-settings with string number returns 400', async () => {
    await clearDatabase();

    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .put('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ maxMissedDonationsBeforeBan: 'hello' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('PUT /admin/system-settings with empty body returns 400', async () => {
    await clearDatabase();

    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .put('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('GET /admin/system/health returns correct health payload', async () => {
    await clearDatabase();

    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/system/health')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const health = response.body.data;
    expect(health.status).toBe('healthy');
    expect(health.uptime).toMatch(/^\d+d \d+h \d+m$/);
    expect(health.services).toBeDefined();
    expect(health.services.database).toBe('online');
    expect(health.memory).toMatch(/^\d+MB \/ \d+MB$/);
    expect(health.nodeVersion).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('GET /admin/audit-logs returns flat adminName, mapped action, dynamically computed details, and nested pagination', async () => {
    await clearDatabase();

    const admin = await createAdmin({
      fullName: 'John Doe',
      email: 'john.doe@test.com',
    });
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const targetUserId = new mongoose.Types.ObjectId();
    await AuditLog.create({
      adminId: admin._id,
      action: 'user.create_hospital',
      targetType: 'User',
      targetId: targetUserId,
      changes: {
        details: 'Added hospital account',
      },
    });

    const targetUserId2 = new mongoose.Types.ObjectId();
    await AuditLog.create({
      adminId: admin._id,
      action: 'user.ban',
      targetType: 'User',
      targetId: targetUserId2,
    });

    const response = await request(app)
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const logs = response.body.data.logs;
    const pagination = response.body.data.pagination;

    expect(logs).toHaveLength(2);
    expect(pagination).toBeDefined();
    expect(pagination.page).toBe(1);
    expect(pagination.total).toBe(2);
    expect(pagination.totalPages).toBe(1);

    const log1 = logs.find(l => l.action === 'Hospital Added');
    expect(log1).toBeDefined();
    expect(log1.adminName).toBe('john.doe@test.com');
    expect(log1.details).toBe('Added hospital account');
    expect(log1.targetType).toBe('user');

    const log2 = logs.find(l => l.action === 'User Banned');
    expect(log2).toBeDefined();
    expect(log2.adminName).toBe('john.doe@test.com');
    expect(log2.details).toBe(`Banned user account (ID: ${targetUserId2})`);
    expect(log2.targetType).toBe('user');
  });
});
