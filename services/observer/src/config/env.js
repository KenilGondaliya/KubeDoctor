import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const observerRoot = path.resolve(__dirname, "../../");

dotenv.config({
  path: path.join(observerRoot, ".env"),
});

const required = ["DATABASE_URL", "NATS_URL", "CLUSTER_ID"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`[Observer] Missing environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  databaseUrl: process.env.DATABASE_URL,

  natsUrl: process.env.NATS_URL,

  clusterId: process.env.CLUSTER_ID,

  kubeContext: process.env.KUBE_CONTEXT || "minikube",

  reconcileIntervalMs: Number(
    process.env.OBSERVER_RECONCILE_INTERVAL_MS || 30000,
  ),

  reconnectDelayMs: Number(process.env.OBSERVER_RECONNECT_DELAY_MS || 3000),
};
