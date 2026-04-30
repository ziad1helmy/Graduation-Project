import { describe, it, expect, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createAdmin } from '../helpers/factories.js';
import User from '../../src/models/User.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import * as adminService from '../../src/services/admin.service.js';

vi.mock('../../src/middlewares/maintenance.middleware.js', () => ({ invalidateMaintenanceCache: vi.fn() }));

setupTestDB();

describe('Admin Service', () => {
  it('verifyUser marks a user as email verified', async () => {
    const donor = await createDonor({ isEmailVerified: false });
    const admin = await createAdmin();

    const verified = await adminService.verifyUser(donor._id, admin._id);

    expect(verified.isEmailVerified).toBe(true);
    expect(verified.emailVerifiedAt).toBeTruthy();
  });

  it('suspendUser marks a user as suspended', async () => {
    const donor = await createDonor();
    const admin = await createAdmin();

    const suspended = await adminService.suspendUser(donor._id, 'Violation', admin._id);

    expect(suspended.isSuspended).toBe(true);
    expect(suspended.suspendedReason).toBe('Violation');
  });

  it('unsuspendUser clears suspended status', async () => {
    const donor = await createDonor({ isSuspended: true });
    const admin = await createAdmin();

    const unsuspended = await adminService.unsuspendUser(donor._id, admin._id);

    expect(unsuspended.isSuspended).toBe(false);
    expect(unsuspended.suspendedAt).toBeNull();
  });

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
