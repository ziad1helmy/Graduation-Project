import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as rc from '../controllers/reward.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

// All reward routes require authentication
router.use(authMiddleware);

// ── Donor routes ──────────────────────────────────────────

router.get('/points', requireRole('donor'), rc.getPoints);

router.get('/earning-rules', requireRole('donor'), rc.getEarningRules);

router.get('/dashboard', requireRole('donor'), rc.getRewardsDashboard);

router.get('/stats', requireRole('donor'), rc.getRewardsStats);

router.get('/points/history', requireRole('donor'), rc.getPointsHistory);

router.get('/badges', requireRole('donor'), rc.getBadges);

router.get('/catalog', requireRole('donor'), rc.getRewards);

router.get('/history', requireRole('donor'), rc.getHistory);

router.post('/catalog/:rewardId/redeem', requireRole('donor'), rc.redeemReward);

router.get('/redemptions', requireRole('donor'), rc.getRedemptions);

router.get('/leaderboard', rc.getLeaderboard);

// ── Admin routes ──────────────────────────────────────────

router.post('/admin/users/:userId/points/adjust', requireRole('admin', 'superadmin'), rc.adminAdjustPoints);

router.patch('/admin/catalog/:rewardId/status', requireRole('admin', 'superadmin'), rc.adminUpdateRewardStatus);

router.get('/admin/analytics', requireRole('admin', 'superadmin'), rc.adminGetRewardsAnalytics);

export default router;

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────
