import Redis from "ioredis";
import logger from "../utils/logger.js"

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = Redis.createClient({
        url,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      this.client.on('error', (error) => {
        logger.error('Redis error:', error);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.warn('Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      
      return this.client;
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis disconnected');
      }
    } catch (error) {
      logger.error('Redis disconnect error:', error);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }
}

module.exports = new RedisClient();