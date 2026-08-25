import express from "express"
import healthController from '../controllers/healthController'

const router = express.Router();

router.get('/health', healthController.check.bind(healthController));
router.get('/ready', healthController.readiness.bind(healthController));

module.exports = router;