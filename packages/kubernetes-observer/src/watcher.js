import * as k8s from "@kubernetes/client-node";

import { normalizeResourceEvent } from "./normalizer.js";

export class KubernetesWatcher {
  constructor({ kubeConfig, clusterId, onEvent, onError }) {
    this.kubeConfig = kubeConfig;

    this.clusterId = clusterId;

    this.onEvent = onEvent;

    this.onError = onError;

    this.watch = new k8s.Watch(kubeConfig);
  }

  async watchPods() {
    const path = "/api/v1/pods";

    await this.watch.watch(
      path,
      {},
      (type, object) => {
        const event = normalizeResourceEvent({
          clusterId: this.clusterId,

          type,

          object,
        });

        this.onEvent(event);
      },

      (error) => {
        if (error) {
          this.onError(error);
        }
      },
    );
  }

  async watchNamespaces() {
    const path = "/api/v1/namespaces";

    await this.watch.watch(
      path,
      {},
      (type, object) => {
        const event = normalizeResourceEvent({
          clusterId: this.clusterId,

          type,

          object,
        });

        this.onEvent(event);
      },

      (error) => {
        if (error) {
          this.onError(error);
        }
      },
    );
  }
}
