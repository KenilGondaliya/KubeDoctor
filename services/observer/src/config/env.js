import "dotenv/config";

const required = ["DATABASE_URL", "NATS_URL"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`[Observer] Missing environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  databaseUrl: process.env.DATABASE_URL,

  natsUrl: process.env.NATS_URL,

  reconcileIntervalMs: Number(
    process.env.OBSERVER_RECONCILE_INTERVAL_MS || 30000,
  ),

  reconnectDelayMs: Number(process.env.OBSERVER_RECONNECT_DELAY_MS || 3000),
};
