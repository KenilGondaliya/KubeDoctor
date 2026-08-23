import express from 'express';
import { scan, incidents, diagnosis } from '../controllers/incident.controller.js';

const router = express.Router();
router.post('/scan', scan);
router.get('/', incidents);
router.get('/diagnosis/:id', diagnosis);
export default router;
