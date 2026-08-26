import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "http";
import WebSocket from "ws";

import database from "./config/database.js";
import redis from "./config/redis.js";
import kubernetesClient from "./config/kubernetes.js";
import observer from "./services/kubernetes/observer.js";
import incidentService from "./services/incidentService.js";
import evidenceService from "./services/evidenceService.js";
import logger from "./utils/logger.js";
import errorHandler from "./middleware/errorHandler.js";

// Routes
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import incidentRoutes from "./routes/incidents.js";

// Initialize Express
const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });
const clients = new Set();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});

app.use("/api", limiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  next();
});

// Routes
app.use("/", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/incidents", incidentRoutes);

// 404 handler
app.use(errorHandler.notFound.bind(errorHandler));

// Error handler
app.use(errorHandler.handle.bind(errorHandler));

// WebSocket handling
wss.on("connection", (ws, req) => {
  const clientId = req.headers["x-client-id"] || "anonymous";

  clients.add(ws);

  logger.info(`WebSocket client connected: ${clientId}`);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      logger.debug(`WebSocket message from ${clientId}:`, data);

      if (data.type === "SUBSCRIBE_INCIDENT") {
        ws.incidentId = data.incidentId;

        ws.send(
          JSON.stringify({
            type: "SUBSCRIBED",
            incidentId: data.incidentId,
          })
        );
      }
    } catch (error) {
      logger.error("WebSocket message error:", error);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);

    logger.info(`WebSocket client disconnected: ${clientId}`);
  });

  ws.send(
    JSON.stringify({
      type: "CONNECTED",
      timestamp: new Date().toISOString(),
    })
  );
});

// Broadcast incident updates
const broadcastIncidentUpdate = (incident) => {
  const message = JSON.stringify({
    type: "INCIDENT_UPDATED",
    incidentId: incident._id,
    status: incident.status,
    timestamp: new Date().toISOString(),
    incident,
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
};

// Port
const PORT = process.env.PORT || 3000;

// Start server
async function startServer() {
  try {
    // Connect database
    await database.connect();
    logger.info("Database connected");

    // Connect Redis
    await redis.connect();
    logger.info("Redis connected");

    // Initialize Kubernetes client
    await kubernetesClient.initialize();
    logger.info("Kubernetes client initialized");

    // Start Kubernetes observer
    await observer.startWatching();
    logger.info("Kubernetes observer started");

    // Observer event
    observer.on("event", async (event) => {
      try {
        const incident = await incidentService.detectIncident(event);

        if (!incident) {
          return;
        }

        logger.info(
          `Incident detected: ${incident._id} (${incident.type})`
        );

        // Broadcast detected incident
        broadcastIncidentUpdate(incident);

        // Automatic investigation
        try {
          const evidence = await evidenceService.collectEvidence(
            incident._id,
            incident
          );

          logger.info(
            `Collected ${evidence.length} evidence items for ${incident._id}`
          );

          // Update incident status
          await incidentService.updateIncidentStatus(
            incident._id,
            "DIAGNOSED"
          );

          // Get updated incident
          const updatedIncident =
            await incidentService.getIncident(incident._id);

          // Broadcast updated incident
          broadcastIncidentUpdate(updatedIncident);
        } catch (investigationError) {
          logger.error(
            "Auto-investigation failed:",
            investigationError
          );
        }
      } catch (error) {
        logger.error("Event processing error:", error);
      }
    });

    // Batch event
    observer.on("batch", async (events) => {
      logger.debug(`Processing batch of ${events.length} events`);

      for (const event of events) {
        try {
          const incident =
            await incidentService.detectIncident(event);

          if (incident) {
            broadcastIncidentUpdate(incident);
          }
        } catch (error) {
          logger.error(
            "Batch event processing error:",
            error
          );
        }
      }
    });

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(
        `KubeDoctor API server running on port ${PORT}`
      );

      logger.info(
        `WebSocket server running on ws://localhost:${PORT}`
      );

      logger.info(
        `Environment: ${process.env.NODE_ENV || "development"}`
      );
    });

    // Graceful shutdown handlers
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  logger.info(
    "Received shutdown signal, starting graceful shutdown..."
  );

  try {
    // Stop Kubernetes observer
    observer.stopWatching();
    logger.info("Observer stopped");

    // Close WebSocket clients
    for (const client of clients) {
      client.close(1000, "Server shutting down");
    }

    wss.close();
    logger.info("WebSocket server closed");

    // Close HTTP server
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    logger.info("HTTP server closed");

    // Disconnect Redis
    await redis.disconnect();
    logger.info("Redis disconnected");

    // Disconnect MongoDB
    await database.disconnect();
    logger.info("MongoDB disconnected");

    logger.info("Graceful shutdown complete");

    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown:", error);

    process.exit(1);
  }
}

// Uncaught exception
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);

  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Unhandled promise rejection
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
});

// Start application
startServer();

// ES Module exports
export {
  app,
  server,
  wss,
  broadcastIncidentUpdate,
};