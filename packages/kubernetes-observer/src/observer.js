import { KubernetesWatcher } from "./watcher.js";

export class KubernetesObserver {
  constructor({ kubeConfig, clusterId, onEvent, onError }) {
    this.clusterId = clusterId;

    this.watcher = new KubernetesWatcher({
      kubeConfig,

      clusterId,

      onEvent,

      onError,
    });
  }

  async start() {
    console.log(`[Observer] Starting cluster ${this.clusterId}`);

    await Promise.all([
      this.watcher.watchPods(),
      this.watcher.watchNamespaces(),
    ]);

    console.log(`[Observer] Started cluster ${this.clusterId}`);
  }
}
