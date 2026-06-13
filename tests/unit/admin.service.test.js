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

  it('getUserStats returns counts by role', async () => {
    const stats = await adminService.getUserStats();

    expect(stats).toHaveProperty('totalUsers');
    expect(stats).toHaveProperty('totalDonors');
    expect(stats).toHaveProperty('totalHospitals');
    expect(typeof stats.totalUsers).toBe('number');
  });
});
