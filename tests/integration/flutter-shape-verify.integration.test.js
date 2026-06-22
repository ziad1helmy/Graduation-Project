import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createAdmin, createDonor, createHospital, createRequest, createDonation } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';

setupTestDB();

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
const isStr = (v) => typeof v === 'string';
const isBool = (v) => v === true || v === false;
const isNumOrNull = (v) => v === null || typeof v === 'number';
const isStrOrNull = (v) => v === null || typeof v === 'string';

describe('Flutter model shape verification', () => {
  it('GET /analytics/overview matches AnalyticsOverviewModel exactly', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor({ bloodType: 'O+' });
    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { urgency: 'critical', bloodType: ['O+'] });
    await createDonation(donor._id, req._id, {
      status: 'completed',
      completedDate: new Date(),
    });

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/analytics/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    const body = response.body;
    expect(typeof body.success).toBe('boolean');
    expect(typeof body.message).toBe('string');
    expect(typeof body.data).toBe('object');

    const data = body.data;
    expect(isStr(data.growthRate)).toBe(true);
    expect(isStr(data.successRate)).toBe(true);

    expect(typeof data.monthlyTrend).toBe('object');
    expect(Array.isArray(data.monthlyTrend.values)).toBe(true);
    expect(Array.isArray(data.monthlyTrend.labels)).toBe(true);
    expect(data.monthlyTrend.values.length).toBe(7);
    expect(data.monthlyTrend.labels.length).toBe(7);
    data.monthlyTrend.values.forEach((v) => expect(isInt(v)).toBe(true));
    data.monthlyTrend.labels.forEach((l) => expect(isStr(l)).toBe(true));

    expect(Array.isArray(data.aiPredictions)).toBe(true);
    data.aiPredictions.forEach((p) => expect(isStr(p)).toBe(true));
  });

  it('GET /analytics/dashboard matches AnalyticsModel exactly', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor({ bloodType: 'O+', dateOfBirth: '1995-01-15' });
    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { urgency: 'critical', bloodType: ['O+'] });
    await createDonation(donor._id, req._id, {
      status: 'completed',
      completedDate: new Date(),
    });

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/analytics/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    const body = response.body;
    expect(typeof body.success).toBe('boolean');
    expect(typeof body.message).toBe('string');

    const data = body.data;

    expect(isInt(data.totalDonors)).toBe(true);
    expect(isStr(data.totalDonorsGrowth)).toBe(true);
    expect(isInt(data.activeRequests)).toBe(true);
    expect(isStr(data.activeRequestsGrowth)).toBe(true);
    expect(isInt(data.criticalCases)).toBe(true);
    expect(isStr(data.criticalCasesGrowth)).toBe(true);
    expect(isInt(data.successfulDonations)).toBe(true);
    expect(isStr(data.successfulDonationsGrowth)).toBe(true);

    expect(typeof data.weeklyTrends).toBe('object');
    expect(Array.isArray(data.weeklyTrends.values)).toBe(true);
    expect(Array.isArray(data.weeklyTrends.labels)).toBe(true);
    expect(data.weeklyTrends.values.length).toBe(7);
    expect(data.weeklyTrends.labels.length).toBe(7);
    data.weeklyTrends.values.forEach((v) => expect(isInt(v)).toBe(true));
    data.weeklyTrends.labels.forEach((l) => expect(isStr(l)).toBe(true));

    expect(Array.isArray(data.criticalAlerts)).toBe(true);
    if (data.criticalAlerts.length > 0) {
      const alert = data.criticalAlerts[0];
      expect(isStr(alert.id)).toBe(true);
      expect(isStr(alert.title)).toBe(true);
      expect(isStr(alert.type)).toBe(true);
      expect(isStr(alert.description)).toBe(true);
      expect(isInt(alert.unitsNeeded)).toBe(true);
      expect(Array.isArray(alert.bloodTypesNeeded)).toBe(true);
      alert.bloodTypesNeeded.forEach((b) => expect(isStr(b)).toBe(true));
      expect(isStr(alert.hospitalId)).toBe(true);
      expect(isStr(alert.hospitalName)).toBe(true);
      expect(isStrOrNull(alert.hospitalContact)).toBe(true);
      expect(isStrOrNull(alert.location)).toBe(true);
      expect(isNumOrNull(alert.latitude)).toBe(true);
      expect(isNumOrNull(alert.longitude)).toBe(true);
      expect(isNumOrNull(alert.predictMatchPercentage)).toBe(true);
      expect(isStrOrNull(alert.date)).toBe(true);
      expect(isStrOrNull(alert.createdAt)).toBe(true);
    }

    expect(typeof data.bloodTypeDistribution).toBe('object');
    const dist = data.bloodTypeDistribution;
    ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].forEach((bt) => {
      expect(isInt(dist[bt])).toBe(true);
    });

    expect(Array.isArray(data.topDonors)).toBe(true);
    if (data.topDonors.length > 0) {
      const donor = data.topDonors[0];
      expect(isStr(donor.id)).toBe(true);
      expect(isStr(donor.name)).toBe(true);
      expect(isStr(donor.email)).toBe(true);
      expect(isStrOrNull(donor.phoneNumber)).toBe(true);
      expect(isStrOrNull(donor.bloodType)).toBe(true);
      expect(isInt(donor.totalDonations)).toBe(true);
      expect(isInt(donor.points)).toBe(true);
      expect(isBool(donor.isEligibleToDonate)).toBe(true);
      expect(isBool(donor.isActive)).toBe(true);
      expect(isBool(donor.isVerified)).toBe(true);
      expect(isStrOrNull(donor.location)).toBe(true);
      expect(isStrOrNull(donor.gender)).toBe(true);
      expect(isNumOrNull(donor.age)).toBe(true);
      expect(isNumOrNull(donor.weight)).toBe(true);
      expect(isStrOrNull(donor.healthStatus)).toBe(true);
      expect(isBool(donor.isBanned)).toBe(true);
      expect(isInt(donor.donorRank)).toBe(true);
      expect(isStrOrNull(donor.createdAt)).toBe(true);
    }

    expect(Array.isArray(data.aiInsights)).toBe(true);
    if (data.aiInsights.length > 0) {
      const insight = data.aiInsights[0];
      expect(isStr(insight.title)).toBe(true);
      expect(isStr(insight.description)).toBe(true);
      expect(isInt(insight.confidence)).toBe(true);
    }
  });

  it('GET /admin/dashboard matches AnalyticsModel exactly (same as /analytics/dashboard)', async () => {
    await clearDatabase();
    const admin = await createAdmin();
    const donor = await createDonor({ bloodType: 'A+' });
    const hospital = await createHospital();
    const req = await createRequest(hospital._id, { urgency: 'critical', bloodType: ['A+'] });
    await createDonation(donor._id, req._id, {
      status: 'completed',
      completedDate: new Date(),
    });

    const token = signToken({ userId: admin._id.toString(), role: admin.role });

    const response = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    const data = response.body.data;

    expect(isInt(data.totalDonors)).toBe(true);
    expect(isStr(data.totalDonorsGrowth)).toBe(true);
    expect(isInt(data.activeRequests)).toBe(true);
    expect(isStr(data.activeRequestsGrowth)).toBe(true);
    expect(isInt(data.criticalCases)).toBe(true);
    expect(isStr(data.criticalCasesGrowth)).toBe(true);
    expect(isInt(data.successfulDonations)).toBe(true);
    expect(isStr(data.successfulDonationsGrowth)).toBe(true);

    expect(typeof data.weeklyTrends).toBe('object');
    expect(Array.isArray(data.weeklyTrends.values)).toBe(true);
    expect(Array.isArray(data.weeklyTrends.labels)).toBe(true);
    expect(data.weeklyTrends.values.length).toBe(7);
    data.weeklyTrends.values.forEach((v) => expect(isInt(v)).toBe(true));

    expect(Array.isArray(data.criticalAlerts)).toBe(true);
    expect(typeof data.bloodTypeDistribution).toBe('object');
    ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].forEach((bt) => {
      expect(isInt(data.bloodTypeDistribution[bt])).toBe(true);
    });

    expect(Array.isArray(data.topDonors)).toBe(true);
    expect(Array.isArray(data.aiInsights)).toBe(true);
  });
});
