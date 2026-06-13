import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as ac from '../controllers/analytics.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

// All analytics routes require authentication
router.use(authMiddleware);


router.get('/my-stats', requireRole('donor'), ac.getMyStats);


router.get('/leaderboard', requireRole('donor'), ac.getLeaderboard);


router.get('/donation-types', requireRole('donor'), ac.getDonationTypeStats);


router.get('/dashboard', requireRole('admin'), ac.getDashboardSummary);


router.get('/overview', requireRole('admin'), ac.getAnalyticsOverview);

export default router;
