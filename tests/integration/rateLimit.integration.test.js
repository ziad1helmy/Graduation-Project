import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

// We don't need database helper if we are only testing rate limiting headers and limits,
// but we import setupTestDB to prevent mongoose connection errors if other files run.
import { setupTestDB } from '../helpers/db.js';
setupTestDB();

describe('Rate Limiting Integration Tests', () => {
  it('should apply relaxed limits to search endpoints', async () => {
    // Under dev config: searchFilterLimiter max is 200.
    // Let's send a single request and verify the rate limiting headers are returned.
    const res = await request(app).get('/hospitals/search');
    
    // It should have standard rate limiting headers
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
    expect(res.headers).not.toHaveProperty('x-ratelimit-limit'); // legacy header should be false
    
    // In dev, searchFilterLimiter max limit is 200
    expect(res.headers['ratelimit-limit']).toBe('200');
  });

  it('should apply relaxed limits to dashboard/list endpoints', async () => {
    // Under dev config: dashboardLimiter max is 200.
    const res = await request(app).get('/dashboard'); // direct alias
    expect(res.headers['ratelimit-limit']).toBe('200');
  });

  it('should apply expensive limits to expensive GET endpoints', async () => {
    // Under dev config: expensiveGetLimiter max is 100.
    const res = await request(app)
      .get('/donor/matches')
      .set('Authorization', 'Bearer invalid-token'); // will fail auth later, but hits rate limiter first
    expect(res.headers['ratelimit-limit']).toBe('100');
  });

  it('should apply strict limits to auth endpoints', async () => {
    // Under dev config: authLimiter max is 150.
    const res = await request(app).post('/auth/login');
    expect(res.headers['ratelimit-limit']).toBe('150');
  });

  it('should use route-specific limiters with independent stores/counters', async () => {
    // Let's make requests to two different route prefixes and ensure they don't affect each other.
    // We will use endpoints that fall back to route-specific limiters.
    // In dev, donorLimiter and hospitalLimiter both have max limit of 300.
    const resDonor = await request(app).get('/donor/profile');
    const resHospital = await request(app).get('/hospital/profile');

    expect(resDonor.headers['ratelimit-limit']).toBe('300');
    expect(resHospital.headers['ratelimit-limit']).toBe('300');

    // Both should have remaining count of 299 since they are independent counters.
    expect(resDonor.headers['ratelimit-remaining']).toBe('299');
    expect(resHospital.headers['ratelimit-remaining']).toBe('299');
  });
});
