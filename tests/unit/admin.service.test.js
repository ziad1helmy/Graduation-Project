import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createAdmin } from '../helpers/factories.js';
import User from '../../src/models/User.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import * as adminService from '../../src/services/admin.service.js';

vi.mock('../../src/middlewares/maintenance.middleware.js', () => ({ invalidateMaintenanceCache: vi.fn() }));

setupTestDB();

describe('Admin Service', () => {
  it('logAudit creates an audit log entry', async () => {
    const admin = await createAdmin();
    const donor = await createDonor();

    await adminService.logAudit(admin._id, 'user.verify', 'User', donor._id);

    const log = await AuditLog.findOne({ adminId: admin._id, action: 'user.verify' });
    expect(log).toBeTruthy();
    expect(log.targetType).toBe('User');
  });

  it('computeUserStats returns counts by role with growth and AI insights', async () => {
    const stats = await adminService.computeUserStats();

    expect(stats).toHaveProperty('totalUsers');
    expect(stats).toHaveProperty('totalDonors');
    expect(stats).toHaveProperty('totalHospitals');
    expect(stats).toHaveProperty('totalUsersGrowth');
    expect(stats).toHaveProperty('totalDonorsGrowth');
    expect(stats).toHaveProperty('aiInsights');
    expect(typeof stats.totalUsers).toBe('number');
    expect(typeof stats.totalUsersGrowth).toBe('string');
    expect(Array.isArray(stats.aiInsights)).toBe(true);
  });
});
