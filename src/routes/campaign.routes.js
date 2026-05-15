import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as cc from '../controllers/campaign.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

// All campaign routes require authentication
router.use(authMiddleware);

router.get('/active', cc.getActiveCampaigns);

router.get('/', requireRole('admin'), cc.listCampaigns);
router.post('/', requireRole('admin'), cc.createCampaign);

router.put('/:campaignId', requireRole('admin'), cc.updateCampaign);

router.post('/:campaignId/activate', requireRole('admin'), cc.activateCampaign);

router.post('/:campaignId/deactivate', requireRole('admin'), cc.deactivateCampaign);

router.get('/:campaignId/metrics', requireRole('admin'), cc.getCampaignMetrics);

router.delete('/:campaignId', requireRole('admin'), cc.deleteCampaign);

export default router;

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────
