import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import { createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import * as analyticsService from '../../src/services/analytics.service.js';
import User from '../../src/models/User.model.js';
import Donation from '../../src/models/Donation.model.js';
import Request from '../../src/models/Request.model.js';

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

    expect(summary).toHaveProperty('users');
    expect(summary).toHaveProperty('requests');
    expect(summary).toHaveProperty('donations');
    expect(summary).toHaveProperty('alerts');
    expect(summary.users.donors).toBeGreaterThan(0);
    expect(summary.requests.critical).toBeGreaterThan(0);
  });

  it('getDonationTrends aggregates monthly donation data', async () => {
    const hospital = await createHospital();
    const request = await createRequest(hospital._id);
    const donor = await createDonor();

    // Create donations for current month
    await createDonation(donor._id, request._id, { status: 'completed', quantity: 1 });
    await createDonation(donor._id, request._id, { status: 'completed', quantity: 1 });
    await createDonation(donor._id, request._id, { status: 'cancelled' });

    const trends = await analyticsService.getDonationTrends(6);

    expect(Array.isArray(trends)).toBe(true);
    const currentMonth = trends.find((t) => t.month === new Date().getMonth() + 1);
    expect(currentMonth).toBeTruthy();
    expect(currentMonth.total).toBeGreaterThanOrEqual(3);
    expect(currentMonth.successRate).toBeTruthy();
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
    // Top donor should have more completed donations
    expect(topDonors[0].completedDonations).toBeGreaterThanOrEqual(topDonors[topDonors.length - 1].completedDonations);
  });

  it('getGrowthMetrics tracks user, request, and donation growth', async () => {
    // Create data
    await createDonor();
    await createHospital();
    const hospital = await createHospital();
    await createRequest(hospital._id);
    const donor = await createDonor();
    const request = await createRequest(hospital._id);
    await createDonation(donor._id, request._id, { status: 'completed' });

    const metrics = await analyticsService.getGrowthMetrics(6);

    expect(metrics).toHaveProperty('userGrowth');
    expect(metrics).toHaveProperty('requestGrowth');
    expect(metrics).toHaveProperty('donationGrowth');
    expect(Array.isArray(metrics.userGrowth)).toBe(true);
    expect(Array.isArray(metrics.requestGrowth)).toBe(true);
    expect(Array.isArray(metrics.donationGrowth)).toBe(true);
  });
});
