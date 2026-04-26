import { Router } from 'express';
import * as discoveryController from '../controllers/discovery.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Discovery
 *     description: Public hospital discovery APIs
 */

/**
 * @swagger
 * /hospitals:
 *   get:
 *     summary: List hospitals for discovery
 *     tags: [Discovery]
 *     description: Public discovery endpoint. Compatibility alias is also mounted under `/api/v1/hospitals`.
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: governorate
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: skip
 *         schema: { type: integer }
 *         description: Legacy pagination alias still supported for compatibility.
 *     responses:
 *       200:
 *         description: Hospitals list
 */
router.get('/', discoveryController.listHospitals);

/**
 * @swagger
 * /hospitals/nearby:
 *   get:
 *     summary: List nearby hospitals
 *     tags: [Discovery]
 *     description: Returns hospitals sorted by computed distance when coordinate-backed hospital locations exist.
 *     parameters:
 *       - in: query
 *         name: latitude
 *         schema: { type: number }
 *       - in: query
 *         name: longitude
 *         schema: { type: number }
 *       - in: query
 *         name: radius_km
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Nearby hospitals list
 */
router.get('/nearby', discoveryController.getNearbyHospitals);

/**
 * @swagger
 * /hospitals/{id}:
 *   get:
 *     summary: Get hospital details by id
 *     tags: [Discovery]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Hospital details
 */
router.get('/:id', discoveryController.getHospitalById);

export default router;
