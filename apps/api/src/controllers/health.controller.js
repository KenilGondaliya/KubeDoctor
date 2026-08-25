import logger from '../utils/logger'
import database from '../config/database'
import redis from '../config/redis'
import kubernetesClient from '../config/kubernetes'

class HealthController {
  async check(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          api: {
            status: 'healthy'
          },
          database: {
            status: database.isConnected ? 'healthy' : 'unhealthy'
          },
          redis: {
            status: redis.isConnected ? 'healthy' : 'unhealthy'
          },
          kubernetes: {
            status: kubernetesClient.isConnected ? 'healthy' : 'unhealthy'
          }
        }
      };

      const allHealthy = Object.values(health.services).every(s => s.status === 'healthy');
      const statusCode = allHealthy ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async readiness(req, res) {
    try {
      const checks = {
        database: database.isConnected,
        redis: redis.isConnected,
        kubernetes: kubernetesClient.isConnected
      };

      const allReady = Object.values(checks).every(v => v === true);
      
      res.status(allReady ? 200 : 503).json({
        status: allReady ? 'ready' : 'not-ready',
        checks: checks,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'not-ready',
        error: error.message
      });
    }
  }
}

module.exports = new HealthController();