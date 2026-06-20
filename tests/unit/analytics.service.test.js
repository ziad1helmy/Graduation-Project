import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import * as analyticsService from '../../src/services/analytics.service.js';
import User from '../../src/models/User.model.js';
import Donation from '../../src/models/Donation.model.js';
import Request from '../../src/models/Request.model.js';
import DonorPoints from '../../src/models/DonorPoints.model.js';

setupTestDB();

describe('Analytics Service', () => {
  it('getDashboardSummary returns key metrics', async () => {
    // Create test data
    await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const request = await createRequest(hospital._id, { urgency: 'critical', status: 'pending' });
    const donor = await createDonor();
    await createDonation(donor._id, request._id, { status: 'pending' });

    const summary = await analyticsService.getDashboardSummary();

    expect(summary).toHaveProperty('totalDonors');
    expect(summary).toHaveProperty('totalDonorsGrowth');
    expect(summary).toHaveProperty('activeRequests');
    expect(summary).toHaveProperty('activeRequestsGrowth');
    expect(summary).toHaveProperty('criticalCases');
    expect(summary).toHaveProperty('criticalCasesGrowth');
    expect(summary).toHaveProperty('successfulDonations');
    expect(summary).toHaveProperty('successfulDonationsGrowth');
    expect(summary).toHaveProperty('weeklyTrends');
    expect(summary).toHaveProperty('criticalAlerts');
    expect(summary).toHaveProperty('bloodTypeDistribution');
    expect(summary).toHaveProperty('topDonors');
    expect(summary).toHaveProperty('aiInsights');
    expect(summary.totalDonors).toBeGreaterThan(0);
    expect(summary.criticalCases).toBeGreaterThan(0);
    expect(Array.isArray(summary.criticalAlerts)).toBe(true);
    if (summary.criticalAlerts.length > 0) {
      expect(summary.criticalAlerts[0]).toHaveProperty('id');
      expect(summary.criticalAlerts[0]).toHaveProperty('title');
      expect(summary.criticalAlerts[0]).toHaveProperty('type');
      expect(summary.criticalAlerts[0]).toHaveProperty('description');
      expect(summary.criticalAlerts[0]).toHaveProperty('unitsNeeded');
      expect(summary.criticalAlerts[0]).toHaveProperty('bloodTypesNeeded');
      expect(summary.criticalAlerts[0]).toHaveProperty('hospitalId');
      expect(summary.criticalAlerts[0]).toHaveProperty('hospitalName');
      expect(summary.criticalAlerts[0]).toHaveProperty('createdAt');
    }
    expect(Array.isArray(summary.topDonors)).toBe(true);
    if (summary.topDonors.length > 0) {
      expect(summary.topDonors[0]).toHaveProperty('id');
      expect(summary.topDonors[0]).toHaveProperty('name');
      expect(summary.topDonors[0]).toHaveProperty('email');
      expect(summary.topDonors[0]).toHaveProperty('bloodType');
      expect(summary.topDonors[0]).toHaveProperty('totalDonations');
      expect(summary.topDonors[0]).toHaveProperty('points');
      expect(summary.topDonors[0]).toHaveProperty('donorRank');
    }
    expect(Array.isArray(summary.aiInsights)).toBe(true);
    if (summary.aiInsights.length > 0) {
      expect(typeof summary.aiInsights[0]).toBe('object');
      expect(summary.aiInsights[0]).toHaveProperty('title');
      expect(summary.aiInsights[0]).toHaveProperty('description');
      expect(summary.aiInsights[0]).toHaveProperty('confidence');
    }
  });

  it('getBloodTypeDistribution returns donor and request distribution', async () => {
    await createDonor({ bloodType: 'O+' });
    await createDonor({ bloodType: 'A+' });
    const hospital = await createHospital();
    await createRequest(hospital._id, { bloodType: 'O+', status: 'pending' });

    const distribution = await analyticsService.getBloodTypeDistribution();

    expect(Array.isArray(distribution)).toBe(true);
    expect(distribution.length).toBe(8); // All 8 blood types
    const oPos = distribution.find((d) => d.bloodType === 'O+');
    expect(oPos.donors).toBeGreaterThan(0);
    expect(oPos.activeRequests).toBeGreaterThan(0);
  });

  it('getTopDonors returns ranked donors by completed donations', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id);
    const donor1 = await createDonor({ fullName: 'Top Donor' });
    const donor2 = await createDonor({ fullName: 'Low Donor' });

    // Create 3 completed donations for donor1, 1 for donor2
    await createDonation(donor1._id, request._id, { status: 'completed', quantity: 2 });
    await createDonation(donor1._id, request._id, { status: 'completed', quantity: 1 });
    await createDonation(donor1._id, request._id, { status: 'completed', quantity: 1 });
    await createDonation(donor2._id, request._id, { status: 'completed', quantity: 2 });

    const topDonors = await analyticsService.getTopDonors(10);

    expect(Array.isArray(topDonors)).toBe(true);
    expect(topDonors.length).toBeGreaterThan(0);
    // Top donor should have more total donations and include donorRank
    expect(topDonors[0].totalDonations).toBeGreaterThanOrEqual(topDonors[topDonors.length - 1].totalDonations);
    expect(topDonors[0]).toHaveProperty('id');
    expect(topDonors[0]).toHaveProperty('name');
    expect(topDonors[0]).toHaveProperty('email');
    expect(topDonors[0]).toHaveProperty('bloodType');
    expect(topDonors[0]).toHaveProperty('totalDonations');
    expect(topDonors[0]).toHaveProperty('points');
    expect(topDonors[0]).toHaveProperty('donorRank');
    expect(topDonors[0].donorRank).toBe(1);
  });

  it('getLeaderboard ranks verified donors by DonorPoints balance', async () => {
    const recentDate = new Date();
    const lowPointsDonor = await createDonor({ fullName: 'Low Points', lastDonationDate: recentDate });
    const highPointsDonor = await createDonor({ fullName: 'High Points', lastDonationDate: recentDate });

    await DonorPoints.create({
      donorId: lowPointsDonor._id,
      pointsBalance: 100,
      lifetimePointsEarned: 100,
    });
    await DonorPoints.create({
      donorId: highPointsDonor._id,
      pointsBalance: 900,
      lifetimePointsEarned: 900,
    });

    const leaderboard = await analyticsService.getLeaderboard(10, 30);

    expect(leaderboard.count).toBeGreaterThanOrEqual(2);
    expect(leaderboard.leaderboard[0].fullName).toBe('High Points');
    expect(leaderboard.leaderboard[0].pointsBalance).toBe(900);
  });

});
