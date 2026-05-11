import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import requireRole from '../middlewares/role.middleware.js';
import * as cc from '../controllers/campaign.controller.js';

const router = Router();

// All campaign routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /campaigns/active:
 *   get:
 *     summary: Get currently active campaigns
 *     tags: [Donor]
 *     description: |
 *       Returns all campaigns currently active that apply to donor donations.
 *       Campaigns boost points earned on specific donation types (e.g., 1.5x for plasma).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active campaigns
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Active campaigns retrieved
 *               data:
 *                 campaigns:
 *                   - _id: 664c123456789abcdef12348
 *                     name: Summer Blood Drive
 *                     description: Help us meet summer blood supply demands
 *                     multiplier: 1.5
 *                     donationTypes: [blood, plasma]
 *                     startDate: "2026-06-01T00:00:00Z"
 *                     endDate: "2026-08-31T23:59:59Z"
 *                     banner: https://api.example.com/banners/summer.jpg
 *                     pointsBoost: 100
 *                   - _id: 664c123456789abcdef12349
 *                     name: Platelet Week
 *                     description: Critical need for platelets this week
 *                     multiplier: 2.0
 *                     donationTypes: [platelets]
 *                     startDate: "2026-05-12T00:00:00Z"
 *                     endDate: "2026-05-18T23:59:59Z"
 *                     banner: https://api.example.com/banners/platelets.jpg
 *                     pointsBoost: 175
 */
router.get('/active', cc.getActiveCampaigns);

/**
 * @openapi
 * /campaigns:
 *   get:
 *     summary: List all campaigns with filters (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, upcoming, expired]
 *         description: Filter by campaign status
 *       - in: query
 *         name: donationType
 *         schema:
 *           type: string
 *           enum: [blood, plasma, platelets, organ]
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of campaigns matching filters
 *   post:
 *     summary: Create a new campaign (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, startDate, endDate]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Campaign name
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               multiplier:
 *                 type: number
 *                 minimum: 1.0
 *                 maximum: 3.0
 *                 default: 1.0
 *               donationTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [blood, plasma, platelets, organ]
 *                 default: [blood]
 *               bloodTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *               urgencyLevel:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               maxRedemptions:
 *                 type: number
 *               banner:
 *                 type: string
 *                 format: uri
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Campaign created successfully
 */
router.get('/', requireRole('admin'), cc.listCampaigns);
router.post('/', requireRole('admin'), cc.createCampaign);

/**
 * @openapi
 * /campaigns/{campaignId}:
 *   put:
 *     summary: Update campaign (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               multiplier:
 *                 type: number
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Campaign updated successfully
 */
router.put('/:campaignId', requireRole('admin'), cc.updateCampaign);

/**
 * @openapi
 * /campaigns/{campaignId}/activate:
 *   post:
 *     summary: Activate campaign (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campaign activated
 */
router.post('/:campaignId/activate', requireRole('admin'), cc.activateCampaign);

/**
 * @openapi
 * /campaigns/{campaignId}/deactivate:
 *   post:
 *     summary: Deactivate campaign (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campaign deactivated
 */
router.post('/:campaignId/deactivate', requireRole('admin'), cc.deactivateCampaign);

/**
 * @openapi
 * /campaigns/{campaignId}/metrics:
 *   get:
 *     summary: Get campaign performance metrics (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campaign performance metrics
 */
router.get('/:campaignId/metrics', requireRole('admin'), cc.getCampaignMetrics);

/**
 * @openapi
 * /campaigns/{campaignId}:
 *   delete:
 *     summary: Delete campaign (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campaign deleted
 */
router.delete('/:campaignId', requireRole('admin'), cc.deleteCampaign);

export default router;
