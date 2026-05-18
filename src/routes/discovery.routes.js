import { Router } from 'express';
import * as discoveryController from '../controllers/discovery.controller.js';

// ─── API CONTRACT ────────────────────────────────────────────────────────────
// Swagger/OpenAPI documentation for this router lives in /openapi.yaml
// Update openapi.yaml whenever you add, change, or remove an endpoint here.
// Do NOT add inline @openapi JSDoc to this file.
// ─────────────────────────────────────────────────────────────────────────────


const router = Router();

router.get('/', discoveryController.listHospitals);


router.get('/nearby', discoveryController.getNearbyHospitals);


router.get('/search', discoveryController.searchHospitals);


router.get('/map', discoveryController.getHospitalsForMap);


router.get('/:id', discoveryController.getHospitalById);

export default router;
