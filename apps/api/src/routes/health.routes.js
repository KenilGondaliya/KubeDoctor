import { Router } from "express";

import {
  checkDatabaseConnection
} from "../database/postgres.js";

import {
  checkRedisConnection
} from "../config/redis.js";

const router = Router();

router.get("/health", async (req, res) => {
  res.json({
    status: "ok",
    service: "kubedoctor-api",
    timestamp: new Date().toISOString()
  });
});


router.get("/ready", async (req, res) => {
  const checks = {};

  try {
    await checkDatabaseConnection();

    checks.database = "ok";
  } catch (error) {
    checks.database = "failed";
  }

  try {
    await checkRedisConnection();

    checks.redis = "ok";
  } catch (error) {
    checks.redis = "failed";
  }

  const ready =
    checks.database === "ok" &&
    checks.redis === "ok";

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    checks,
    timestamp: new Date().toISOString()
  });
});


export default router;