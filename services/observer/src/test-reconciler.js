import { Reconciler } from "./observer/reconciler.js";
import { connectNats, closeNats } from "./infrastructure/nats.js";
import { env } from "./config/env.js";

const reconciler = new Reconciler({
  kubeContext: env.kubeContext,
  clusterId: env.clusterId,
  intervalMs: env.reconcileIntervalMs,
});

try {
  console.log("[TEST] Connecting to NATS...");

  await connectNats();

  console.log("[TEST] Starting reconciliation...");

  await reconciler.reconcile();

  console.log("[TEST] Reconciliation completed successfully");
} catch (error) {
  console.error("[TEST] Reconciliation failed:", error);
} finally {
  await closeNats();
}