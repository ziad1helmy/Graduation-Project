import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';
import { createAdmin, createDonor, createHospital } from '../helpers/factories.js';
import { signToken } from '../../src/utils/jwt.js';

setupTestDB();

describe('Analytics API Integration', () => {
  describe('GET /analytics/overview', () => {
    it('returns 200 with Flutter-expected shape for admin', async () => {
      await clearDatabase();
      const admin = await createAdmin();

      const token = signToken({ userId: admin._id.toString(), role: admin.role });

      const response = await request(app)
        .get('/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('growthRate');
      expect(typeof response.body.data.growthRate).toBe('string');
      expect(response.body.data).toHaveProperty('successRate');
      expect(typeof response.body.data.successRate).toBe('string');
      expect(response.body.data).toHaveProperty('monthlyTrend');
      expect(response.body.data.monthlyTrend).toHaveProperty('values');
      expect(response.body.data.monthlyTrend).toHaveProperty('labels');
      expect(Array.isArray(response.body.data.monthlyTrend.values)).toBe(true);
      expect(Array.isArray(response.body.data.monthlyTrend.labels)).toBe(true);
      expect(response.body.data).toHaveProperty('aiPredictions');
      expect(Array.isArray(response.body.data.aiPredictions)).toBe(true);
      if (response.body.data.aiPredictions.length > 0) {
        expect(typeof response.body.data.aiPredictions[0]).toBe('string');
      }
    });

    it('returns 401 without auth token', async () => {
      const response = await request(app).get('/analytics/overview');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /analytics/dashboard', () => {
    it('returns 200 with Flutter-expected shape for admin', async () => {
      await clearDatabase();
      const admin = await createAdmin();

      const token = signToken({ userId: admin._id.toString(), role: admin.role });

      const response = await request(app)
        .get('/analytics/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      // Stat cards
      expect(response.body.data).toHaveProperty('totalDonors');
      expect(response.body.data).toHaveProperty('totalDonorsGrowth');
      expect(response.body.data).toHaveProperty('activeRequests');
      expect(response.body.data).toHaveProperty('activeRequestsGrowth');
      expect(response.body.data).toHaveProperty('criticalCases');
      expect(response.body.data).toHaveProperty('criticalCasesGrowth');
      expect(response.body.data).toHaveProperty('successfulDonations');
      expect(response.body.data).toHaveProperty('successfulDonationsGrowth');
      // Weekly trends
      expect(response.body.data).toHaveProperty('weeklyTrends');
      expect(response.body.data.weeklyTrends).toHaveProperty('values');
      expect(response.body.data.weeklyTrends).toHaveProperty('labels');
      expect(Array.isArray(response.body.data.weeklyTrends.values)).toBe(true);
      expect(response.body.data.weeklyTrends.values.length).toBe(7);
      // Critical alerts (Flutter shape)
      expect(response.body.data).toHaveProperty('criticalAlerts');
      expect(Array.isArray(response.body.data.criticalAlerts)).toBe(true);
      if (response.body.data.criticalAlerts.length > 0) {
        const alert = response.body.data.criticalAlerts[0];
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('createdAt');
      }
      // Blood type distribution
      expect(response.body.data).toHaveProperty('bloodTypeDistribution');
      // Top donors (Flutter shape)
      expect(response.body.data).toHaveProperty('topDonors');
      expect(Array.isArray(response.body.data.topDonors)).toBe(true);
      if (response.body.data.topDonors.length > 0) {
        const donor = response.body.data.topDonors[0];
        expect(donor).toHaveProperty('donorId');
        expect(donor).toHaveProperty('fullName');
        expect(donor).toHaveProperty('bloodType');
        expect(donor).toHaveProperty('totalDonations');
        expect(donor).toHaveProperty('points');
        expect(donor).toHaveProperty('tier');
        expect(donor).toHaveProperty('donorRank');
      }
      // aiInsights as string array
      expect(response.body.data).toHaveProperty('aiInsights');
      expect(Array.isArray(response.body.data.aiInsights)).toBe(true);
      if (response.body.data.aiInsights.length > 0) {
        expect(typeof response.body.data.aiInsights[0]).toBe('string');
      }
    });

    it('returns 401 without auth token', async () => {
      const response = await request(app).get('/analytics/dashboard');
      expect(response.status).toBe(401);
    });
  });
});
