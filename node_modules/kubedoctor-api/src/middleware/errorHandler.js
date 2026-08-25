import logger from '../utils/logger'

class ErrorHandler {
  handle(error, req, res, next) {
    logger.error('Error:', {
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    // Mongoose validation error
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        error: 'Validation error',
        details: errors
      });
    }

    // Mongoose duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        error: 'Duplicate entry',
        field: field
      });
    }

    // JWT error
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired'
      });
    }

    // Kubernetes client error
    if (error.response && error.response.statusCode) {
      return res.status(error.response.statusCode).json({
        error: 'Kubernetes API error',
        message: error.message,
        statusCode: error.response.statusCode
      });
    }

    // Default error
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message || 'Internal server error'
    });
  }

  notFound(req, res) {
    res.status(404).json({
      error: 'Route not found',
      path: req.path
    });
  }
}

module.exports = new ErrorHandler();