import express from 'express';
import { scan, diagnosis, listIncidents,
    getIncident
 } from '../controllers/incident.controller.js';

const router = express.Router();
router.post('/scan', scan);
router.get('/diagnosis/:id', diagnosis);
router.get("/", listIncidents);
router.get("/:id", getIncident);

export default router;
