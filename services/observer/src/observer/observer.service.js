import { loadKubeConfig } from "../config/kubernetes.js";

import { WatchManager } from "./watch.manager.js";

import { Reconciler } from "./reconciler.js";

import { env } from "../config/env.js";

export class ObserverService {
  constructor({ clusterId, kubeContext }) {
    this.clusterId = clusterId;

    this.kubeContext = kubeContext;

    this.kubeConfig = loadKubeConfig(kubeContext);

    this.watchManager = new WatchManager({
      kubeConfig: this.kubeConfig,

      clusterId,
    });

    this.reconciler = new Reconciler({
      kubeContext,

      clusterId,

      intervalMs: env.reconcileIntervalMs,
    });
  }

  async start() {
    console.log(`[Observer] Starting ${this.clusterId}`);

    await this.reconciler.start();

    this.watchManager.start().catch((error) => {
      console.error("[Observer] Watch manager failed:", error);
    });

    console.log(`[Observer] Running ${this.clusterId}`);
  }

  async stop() {
    await this.watchManager.stop();

    this.reconciler.stop();

    console.log(`[Observer] Stopped ${this.clusterId}`);
  }
}
