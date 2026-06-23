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
  it('GET /admin/system-settings returns profile details, settings toggles, and system health', async () => {
    await clearDatabase();
    
    // Create an admin with custom position, department, and encrypted adminKey
    const adminId = new mongoose.Types.ObjectId();
    const encryptedKey = encryptAdminKey('test-admin-secret-access-key', adminId.toString());
    const admin = await createAdmin({
      _id: adminId,
      position: 'Director of IT',
      department: 'Infrastructure',
      adminKey: encryptedKey,
    });
    
    // Seed system settings
    await SystemSettings.create([
      { key: 'emergency_alerts_enabled', value: true, updatedBy: admin._id },
      { key: 'ai_predictions_enabled', value: false, updatedBy: admin._id },
      { key: 'maintenance_mode', value: false, updatedBy: admin._id },
    ]);

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // Verify Admin profile details mapping
    const adminData = response.body.data.admin;
    expect(adminData).toBeDefined();
    expect(adminData._id).toBe(admin._id.toString());
    expect(adminData.position).toBe('Director of IT');
    expect(adminData.department).toBe('Infrastructure');
    expect(adminData.adminAccessKey).toBe('test-admin-secret-access-key');
    
    // Verify Settings toggles mapping (must NOT contain twoFactorAuthEnabled)
    const settingsData = response.body.data.settings;
    expect(settingsData).toBeDefined();
    expect(settingsData.emergencyAlertsEnabled).toBe(true);
    expect(settingsData.aiPredictionsEnabled).toBe(false);
    expect(settingsData.maintenanceModeEnabled).toBe(false);
    expect(settingsData.twoFactorAuthEnabled).toBeUndefined();

    // Verify Health status structure matches the nested services status map
    const healthData = response.body.data.systemHealth;
    expect(healthData).toBeDefined();
    expect(healthData.status).toBe('healthy');
    expect(healthData.uptime).toMatch(/^\d+d \d+h \d+m$/);
    expect(healthData.services).toHaveProperty('database', 'online');
    expect(healthData.memory).toMatch(/^\d+MB \/ \d+MB$/);
    expect(healthData.nodeVersion).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('PUT /admin/system-settings updates system settings', async () => {
    await clearDatabase();
    
    const admin = await createAdmin();
    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    // Initial seed
    await SystemSettings.create([
      { key: 'emergency_alerts_enabled', value: true, updatedBy: admin._id },
      { key: 'ai_predictions_enabled', value: true, updatedBy: admin._id },
    ]);

    const response = await request(app)
      .put('/admin/system-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        emergencyAlertsEnabled: false,
        aiPredictionsEnabled: false,
        maintenanceModeEnabled: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    const settings = response.body.data.settings;
    expect(settings.emergencyAlertsEnabled).toBe(false);
    expect(settings.aiPredictionsEnabled).toBe(false);
    expect(settings.maintenanceModeEnabled).toBe(true);
    expect(settings.twoFactorAuthEnabled).toBeUndefined();

    // Verify persisted database records
    const emergencyRecord = await SystemSettings.findOne({ key: 'emergency_alerts_enabled' });
    const aiRecord = await SystemSettings.findOne({ key: 'ai_predictions_enabled' });
    const maintenanceRecord = await SystemSettings.findOne({ key: 'maintenance_mode' });

    expect(emergencyRecord.value).toBe(false);
    expect(aiRecord.value).toBe(false);
    expect(maintenanceRecord.value).toBe(true);
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

    // Insert an audit log record
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

    // Insert another audit log record without details in changes to test dynamic computation fallback
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

    // Verify logs contents
    // Log 1: user.create_hospital
    const log1 = logs.find(l => l.action === 'Hospital Added');
    expect(log1).toBeDefined();
    expect(log1.adminName).toBe('john.doe@test.com');
    expect(log1.details).toBe('Added hospital account');
    expect(log1.targetType).toBe('user');

    // Log 2: user.ban
    const log2 = logs.find(l => l.action === 'User Banned');
    expect(log2).toBeDefined();
    expect(log2.adminName).toBe('john.doe@test.com');
    expect(log2.details).toBe(`Banned user account (ID: ${targetUserId2})`);
    expect(log2.targetType).toBe('user');
  });
});
