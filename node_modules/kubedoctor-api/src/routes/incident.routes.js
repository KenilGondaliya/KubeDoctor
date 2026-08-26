import incidentController from '../controllers/incidentController'
import express from "express"
import authMiddleware from '../middleware/auth'
import validation from '../middleware/validation'

const router = express.Router();



// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// List and stats
router.get('/', incidentController.list.bind(incidentController));
router.get('/stats', incidentController.getStats.bind(incidentController));

// Single incident
router.get('/:id', incidentController.get.bind(incidentController));
router.patch(
  '/:id/status',
  validation.validate({ body: validation.schemas.incidentStatus }),
  incidentController.updateStatus.bind(incidentController)
);
router.post('/:id/resolve', incidentController.resolve.bind(incidentController));

// Evidence and timeline
router.get('/:id/evidence', incidentController.getEvidence.bind(incidentController));
router.get('/:id/timeline', incidentController.getTimeline.bind(incidentController));

// Investigation
router.post('/:id/investigate', incidentController.investigate.bind(incidentController));

// Notes
router.post(
  '/:id/notes',
  validation.validate({ body: validation.schemas.incidentNote }),
  incidentController.addNote.bind(incidentController)
);

module.exports = router;