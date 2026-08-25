import Incident from '../models/Incident'
import incidentService from '../services/incidentService'
import evidenceService from '../services/evidenceService'
import logger from '../utils/logger'

class IncidentController {
  async list(req, res) {
    try {
      const filters = {
        status: req.query.status,
        clusterId: req.query.clusterId,
        namespace: req.query.namespace,
        severity: req.query.severity,
        type: req.query.type,
        limit: parseInt(req.query.limit) || 100,
        skip: parseInt(req.query.skip) || 0,
        sort: req.query.sort ? { [req.query.sort]: -1 } : { firstDetectedAt: -1 }
      };

      const incidents = await incidentService.getIncidents(filters);
      
      res.json({
        incidents,
        count: incidents.length,
        total: await Incident.countDocuments()
      });
    } catch (error) {
      logger.error('List incidents error:', error);
      res.status(500).json({ error: 'Failed to list incidents' });
    }
  }

  async get(req, res) {
    try {
      const incident = await incidentService.getIncident(req.params.id);
      
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      res.json(incident);
    } catch (error) {
      logger.error('Get incident error:', error);
      res.status(500).json({ error: 'Failed to get incident' });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      
      const incident = await incidentService.updateIncidentStatus(req.params.id, status);
      
      res.json({
        message: 'Incident status updated',
        incident
      });
    } catch (error) {
      logger.error('Update incident status error:', error);
      res.status(500).json({ error: error.message || 'Failed to update incident status' });
    }
  }

  async resolve(req, res) {
    try {
      const incident = await incidentService.resolveIncident(req.params.id);
      
      res.json({
        message: 'Incident resolved',
        incident
      });
    } catch (error) {
      logger.error('Resolve incident error:', error);
      res.status(500).json({ error: 'Failed to resolve incident' });
    }
  }

  async getEvidence(req, res) {
    try {
      const evidence = await evidenceService.getEvidenceForIncident(req.params.id);
      
      res.json({
        incidentId: req.params.id,
        evidence,
        count: evidence.length
      });
    } catch (error) {
      logger.error('Get evidence error:', error);
      res.status(500).json({ error: 'Failed to get evidence' });
    }
  }

  async getTimeline(req, res) {
    try {
      const timeline = await evidenceService.getEvidenceTimeline(req.params.id);
      
      // Group by timestamp for easier visualization
      const grouped = timeline.reduce((acc, item) => {
        const date = item.timestamp.toISOString().split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(item);
        return acc;
      }, {});

      res.json({
        incidentId: req.params.id,
        timeline: grouped,
        total: timeline.length
      });
    } catch (error) {
      logger.error('Get timeline error:', error);
      res.status(500).json({ error: 'Failed to get timeline' });
    }
  }

  async investigate(req, res) {
    try {
      const incident = await incidentService.getIncident(req.params.id);
      
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Update status to investigating
      await incidentService.updateIncidentStatus(req.params.id, 'INVESTIGATING');

      // Start evidence collection
      const evidence = await evidenceService.collectEvidence(req.params.id, incident);

      // Update to diagnosed for now (will be enhanced in later stages)
      await incidentService.updateIncidentStatus(req.params.id, 'DIAGNOSED');

      res.json({
        message: 'Investigation started',
        incidentId: req.params.id,
        evidenceCollected: evidence.length
      });
    } catch (error) {
      logger.error('Investigate incident error:', error);
      res.status(500).json({ error: 'Failed to investigate incident' });
    }
  }

  async getStats(req, res) {
    try {
      const stats = await incidentService.getIncidentStats();
      
      res.json(stats);
    } catch (error) {
      logger.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  async addNote(req, res) {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Note content required' });
      }

      const incident = await incidentService.addNote(
        req.params.id,
        req.user.id,
        content
      );

      res.json({
        message: 'Note added',
        incident
      });
    } catch (error) {
      logger.error('Add note error:', error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  }
}

module.exports = new IncidentController();