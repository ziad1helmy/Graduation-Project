import { Router } from 'express';
import * as discoveryController from '../controllers/discovery.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Donor
 */

/**
 * @swagger
 * /hospitals:
 *   get:
 *     summary: List hospitals for discovery
 *     tags: [Donor]
 *     description: Public endpoint to discover hospitals. Search and filter by city, governorate, or keywords. Results include hospital contact information and blood inventory status
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *         description: Filter by city name
 *       - in: query
 *         name: governorate
 *         schema: { type: string }
 *         description: Filter by governorate/region
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search hospitals by name or keywords
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Items per page (max 100)
 *       - in: query
 *         name: skip
 *         schema: { type: integer }
 *         description: Legacy pagination - number of items to skip. Still supported for compatibility
 *     responses:
 *       200:
 *         description: Hospitals list retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 hospitals: []
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 0
 */
router.get('/', discoveryController.listHospitals);

/**
 * @swagger
 * /hospitals/nearby:
 *   get:
 *     summary: List nearby hospitals by GPS coordinates
 *     tags: [Donor]
 *     description: Find hospitals within a specified radius from given GPS coordinates. Returns hospitals sorted by distance. Supports both lat/long and legacy latitude/longitude parameters
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *         description: Donor latitude coordinate (-90 to 90). Alias for latitude.
 *       - in: query
 *         name: long
 *         schema: { type: number }
 *         description: Donor longitude coordinate (-180 to 180). Alias for longitude.
 *       - in: query
 *         name: latitude
 *         schema: { type: number }
 *         description: Donor latitude coordinate (deprecated, use lat instead)
 *       - in: query
 *         name: longitude
 *         schema: { type: number }
 *         description: Donor longitude coordinate (deprecated, use long instead)
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Optional keyword filter for hospital name
 *       - in: query
 *         name: bloodType
 *         schema: { type: string }
 *         description: Optional blood type filter
 *       - in: query
 *         name: radius_km
 *         schema: { type: number }
 *         description: Optional max distance in kilometers
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Items per page
 *       - in: query
 *         name: skip
 *         schema: { type: integer }
 *         description: Legacy pagination - number of items to skip
 *     responses:
 *       200:
 *         description: Nearby hospitals list
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Nearby hospitals retrieved successfully
 *               data:
 *                 hospitals:
 *                   - id: 69f3df915f42685cbbbcbb1b
 *                     hospitalId: 69f3df915f42685cbbbcbb1b
 *                     hospital_id: 69f3df915f42685cbbbcbb1b
 *                     name: Cairo Care Hospital
 *                     fullName: Cairo Care Operations
 *                     phoneNumber: "1044444444"
 *                     contactNumber: "1044444444"
 *                     email: ops@cairocare.demo
 *                     address:
 *                       city: Cairo
 *                       governorate: Cairo
 *                     location:
 *                       lat: 30.0511
 *                       lng: 31.2435
 *                     lat: 30.0511
 *                     lng: 31.2435
 *                     hospitalType: General Hospital
 *                     workingHours: 9AM - 5PM
 *                     bloodTypes:
 *                       - O+
 *                       - A-
 *                     isAvailable: true
 *                     urgentNeedsCount: 2
 *                     distanceKm: 2.35
 *                     distanceMeters: 2350
 *                     distance: 2.35 km
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 1
 */
router.get('/nearby', discoveryController.getNearbyHospitals);

/**
 * @swagger
 * /hospitals/search:
 *   get:
 *     summary: Search hospitals by keyword, blood type, and availability
 *     tags: [Donor]
 */
router.get('/search', discoveryController.searchHospitals);

/**
 * @swagger
 * /hospitals/map:
 *   get:
 *     summary: Get hospitals for map markers
 *     tags: [Donor]
 */
router.get('/map', discoveryController.getHospitalsForMap);

/**
 * @swagger
 * /hospitals/{id}:
 *   get:
 *     summary: Get hospital details by id
 *     tags: [Donor]
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
