import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDB } from '../helpers/db.js';
import Badge from '../../src/models/Badge.model.js';
import * as adminController from '../../src/controllers/admin.controller.js';
import { makeMockReq, makeMockRes } from '../helpers/mocks.js';
import { HttpError } from '../../src/utils/HttpError.js';

const expectHttpError = (next, statusCode, messagePattern) => {
  expect(next).toHaveBeenCalledTimes(1);
  const err = next.mock.calls[0][0];
  expect(err).toBeInstanceOf(HttpError);
  expect(err.statusCode).toBe(statusCode);
  if (messagePattern) expect(err.message).toMatch(messagePattern);
};

setupTestDB();

describe('Admin Badge Controller', () => {
  let badge;

  beforeEach(async () => {
    // Clean up and seed one badge for testing
    await Badge.deleteMany({});
    badge = await Badge.create({
      badgeName: 'First Timer Test',
      badgeDescription: 'Completed your first donation',
      badgeIcon: 'heart',
      category: 'DONATION',
      rarity: 'COMMON',
      unlockCondition: 'completedDonations',
      unlockThreshold: 1,
      pointsReward: 10,
      sortOrder: 1,
    });
  });

  describe('getBadges', () => {
    it('retrieves all badges sorted by sortOrder', async () => {
      const req = makeMockReq({});
      const res = makeMockRes();
      const next = vi.fn();

      await adminController.getBadges(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.badges).toHaveLength(1);
      expect(data.badges[0].badgeName).toBe('First Timer Test');
    });
  });

  describe('updateBadge', () => {
    it('updates badge unlockThreshold and pointsReward successfully', async () => {
      const req = makeMockReq({
        params: { id: badge._id.toString() },
        body: { unlockThreshold: 5, pointsReward: 150 },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await adminController.updateBadge(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const updatedBadge = res.json.mock.calls[0][0].data.badge;
      expect(updatedBadge.unlockThreshold).toBe(5);
      expect(updatedBadge.pointsReward).toBe(150);

      // Verify db document
      const dbDoc = await Badge.findById(badge._id);
      expect(dbDoc.unlockThreshold).toBe(5);
      expect(dbDoc.pointsReward).toBe(150);
    });

    it('supports bonusPoints alias for pointsReward update', async () => {
      const req = makeMockReq({
        params: { id: badge._id.toString() },
        body: { bonusPoints: 200 },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await adminController.updateBadge(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const updatedBadge = res.json.mock.calls[0][0].data.badge;
      expect(updatedBadge.pointsReward).toBe(200);
    });

    it('returns 400 for invalid badge ID format', async () => {
      const req = makeMockReq({
        params: { id: 'invalid-id-format' },
        body: { unlockThreshold: 2 },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await adminController.updateBadge(req, res, next);

      expectHttpError(next, 400, /Invalid badge ID/);
    });

    it('returns 404 if badge does not exist', async () => {
      const req = makeMockReq({
        params: { id: '507f1f77bcf86cd799439011' },
        body: { unlockThreshold: 2 },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await adminController.updateBadge(req, res, next);

      expectHttpError(next, 404, /Badge not found/);
    });

    it.each([
      [{ unlockThreshold: 0 }, /unlockThreshold/],
      [{ pointsReward: -5 }, /pointsReward/],
    ])('returns 400 when validation fails (%s)', async (body, pattern) => {
      const req = makeMockReq({
        params: { id: badge._id.toString() },
        body,
      });
      const res = makeMockRes();
      const next = vi.fn();

      await adminController.updateBadge(req, res, next);

      expectHttpError(next, 400, pattern);
    });
  });
});
