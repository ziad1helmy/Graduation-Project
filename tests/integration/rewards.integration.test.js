import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createDonor, createAdmin, createRequest, createHospital } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';
import DonorPoints from '../../src/models/DonorPoints.model.js';
import RewardCatalog from '../../src/models/RewardCatalog.model.js';
import Donation from '../../src/models/Donation.model.js';

setupTestDB();

describe('Rewards Routes Integration', () => {
  it('GET /rewards/points returns donor points summary', async () => {
    await clearDatabase();
    const donor = await createDonor();
    
    // Create donor points record
    await DonorPoints.create({
      donorId: donor._id,
      pointsBalance: 500,
      lifetimePointsEarned: 1000,
      currentTier: 'silver',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/rewards/points')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('pointsBalance');
    expect(response.body.data).toHaveProperty('currentTier');
    expect(response.body.data.pointsBalance).toBe(500);
  });

  it('GET /rewards/points requires donor role', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/rewards/points')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('GET /rewards/catalog returns rewards catalog', async () => {
    await clearDatabase();
    const donor = await createDonor();

    // Create test reward
    await RewardCatalog.create({
      name: 'Coffee Voucher',
      description: 'Free coffee',
      pointsCost: 100,
      category: 'FOOD',
      status: 'ACTIVE',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/rewards/catalog')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('rewards');
    expect(Array.isArray(response.body.data.rewards)).toBe(true);
  });

  it('GET /rewards/badges returns donor badge progress', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/rewards/badges')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('badges');
    expect(Array.isArray(response.body.data.badges)).toBe(true);
  });

  it('GET /rewards/leaderboard returns top donors', async () => {
    await clearDatabase();
    const donor = await createDonor();

    await DonorPoints.create({
      donorId: donor._id,
      pointsBalance: 5000,
      lifetimePointsEarned: 10000,
      currentTier: 'platinum',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/rewards/leaderboard?limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('leaderboard');
    expect(Array.isArray(response.body.data.leaderboard)).toBe(true);
  });

  it('GET /rewards/redemptions returns donor redemption history', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/rewards/redemptions')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('redemptions');
  });

  it('POST /rewards/catalog/:rewardId/redeem redeems a reward', async () => {
    await clearDatabase();
    const donor = await createDonor();

    // Create points for donor
    await DonorPoints.create({
      donorId: donor._id,
      pointsBalance: 500,
      lifetimePointsEarned: 500,
      currentTier: 'silver',
    });

    // Create reward
    const reward = await RewardCatalog.create({
      name: 'Coffee Voucher',
      description: 'Free coffee',
      pointsCost: 100,
      category: 'FOOD',
      status: 'ACTIVE',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .post(`/rewards/catalog/${reward._id}/redeem`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        delivery_preference: 'IN_APP',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('confirmationCode');
  });

  it('POST /rewards/catalog/:rewardId/redeem returns 409 if insufficient points', async () => {
    await clearDatabase();
    const donor = await createDonor();

    // Create insufficient points for donor
    await DonorPoints.create({
      donorId: donor._id,
      pointsBalance: 50,
      lifetimePointsEarned: 50,
      currentTier: 'bronze',
    });

    // Create reward
    const reward = await RewardCatalog.create({
      name: 'Premium Voucher',
      description: 'Expensive reward',
      pointsCost: 1000,
      category: 'HEALTH',
      status: 'ACTIVE',
    });

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .post(`/rewards/catalog/${reward._id}/redeem`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        delivery_preference: 'IN_APP',
      });

    expect(response.status).toBe(409);
  });

  it('POST /rewards/admin/users/:userId/points/adjust adjusts points (admin only)', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor();

    await DonorPoints.create({
      donorId: donor._id,
      pointsBalance: 500,
      lifetimePointsEarned: 500,
      currentTier: 'silver',
    });

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .post(`/rewards/admin/users/${donor._id}/points/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 100,
        reason: 'Bonus for contribution',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.pointsBalance).toBe(600);
  });

  it('POST /rewards/admin/users/:userId/points/adjust requires admin role', async () => {
    await clearDatabase();
    const donor = await createDonor();
    const donor2 = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .post(`/rewards/admin/users/${donor2._id}/points/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 100,
        reason: 'Bonus',
      });

    expect(response.status).toBe(403);
  });

  it('PATCH /rewards/admin/catalog/:rewardId/status updates reward status (admin only)', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const reward = await RewardCatalog.create({
      name: 'Coffee',
      description: 'Free coffee',
      pointsCost: 100,
      category: 'FOOD',
      status: 'ACTIVE',
    });

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .patch(`/rewards/admin/catalog/${reward._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'INACTIVE',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('INACTIVE');
  });

  it('GET /rewards/admin/analytics returns rewards analytics (admin only)', async () => {
    await clearDatabase();
    const admin = await createAdmin();

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/rewards/admin/analytics')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('topRewards');
  });

  it('GET /rewards/admin/analytics requires admin role', async () => {
    await clearDatabase();
    const donor = await createDonor();

    const token = signToken({ userId: donor._id.toString(), role: donor.role });

    const response = await request(app)
      .get('/rewards/admin/analytics')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });
});
