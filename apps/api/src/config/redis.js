import Redis from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.redisUrl);

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

redis.on("error", (error) => {
  console.error("[Redis] Error:", error);
});

export async function checkRedisConnection() {
  return redis.ping();
}