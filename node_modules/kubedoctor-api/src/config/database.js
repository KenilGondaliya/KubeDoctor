import mongoose from "mongoose";
import logger from "../utils/logger.js"

class Database {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    try {
      const uri = process.env.MONGODB_URI;
      
      await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      });

      this.isConnected = true;
      logger.info('MongoDB connected successfully');
      
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      return mongoose.connection;
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected');
    } catch (error) {
      logger.error('MongoDB disconnect error:', error);
      throw error;
    }
  }

  getConnection() {
    return mongoose.connection;
  }
}

module.exports = new Database();