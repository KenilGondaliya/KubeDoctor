import app from "./app.js";

import { env } from "./config/env.js";

import {
  checkDatabaseConnection
} from "./database/postgres.js";

import {
  checkRedisConnection
} from "./config/redis.js";

import {
  connectNats
} from "./config/nats.js";


async function bootstrap() {
  console.log("[KubeDoctor] Starting API...");

  await checkDatabaseConnection();

  console.log("[PostgreSQL] Connected");

  await checkRedisConnection();

  console.log("[Redis] Connected");

  await connectNats();

  app.listen(env.port, () => {
    console.log(
      `[API] KubeDoctor running on http://localhost:${env.port}`
    );
  });
}


bootstrap().catch((error) => {
  console.error(
    "[KubeDoctor] Startup failed:",
    error
  );

  process.exit(1);
});