import { connectNats, closeNats } from "./infrastructure/nats.js";

import { ObserverService } from "./observer/observer.service.js";

const clusterId = process.env.CLUSTER_ID;

const kubeContext = process.env.KUBE_CONTEXT;

if (!clusterId) {
  throw new Error("CLUSTER_ID is required");
}

if (!kubeContext) {
  throw new Error("KUBE_CONTEXT is required");
}

let observer;

async function bootstrap() {
  console.log("[Observer] Bootstrapping...");

  await connectNats();

  observer = new ObserverService({
    clusterId,

    kubeContext,
  });

  await observer.start();
}

async function shutdown(signal) {
  console.log(`[Observer] Received ${signal}`);

  if (observer) {
    await observer.stop();
  }

  await closeNats();

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));

process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap().catch(async (error) => {
  console.error("[Observer] Fatal error:", error);

  await closeNats();

  process.exit(1);
});
