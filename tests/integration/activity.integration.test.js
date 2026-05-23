import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import Activity from '../../src/models/Activity.model.js';

setupTestDB();

describe('Activity Routes Integration', () => {
  it('GET /donor/activity returns activity timeline', async () => {
    await clearDatabase();
    const donor = await createDonor();

    await Activity.create([
      {
        userId: donor._id,
        type: 'profile_update',
        action: 'profile_completed',
        title: 'Profile Completed',
        description: 'Completed profile',
        referenceType: 'User',
        referenceId: `profile_${donor._id}`,
        icon: 'user-check',
      },
      {
        userId: donor._id,
        type: 'donation',
        action: 'completed_donation',
        title: 'Donation Completed',
        description: 'You donated 1 unit',
        referenceType: 'Donation',
        referenceId: `don_${Date.now()}`,
        icon: 'heart',
      },
    ]);

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/donor/activity')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.activities)).toBe(true);
    expect(response.body.data.activities.length).toBeGreaterThanOrEqual(2);
    expect(response.body.data.activities[0]).toHaveProperty('title');
    expect(response.body.data.pagination).toBeDefined();
  });

  it('GET /donor/activity requires authentication', async () => {
    await clearDatabase();

    const response = await request(app).get('/donor/activity');

    expect(response.status).toBe(401);
  });
});
