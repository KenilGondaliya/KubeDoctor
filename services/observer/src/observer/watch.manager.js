import k8s from "@kubernetes/client-node";

import { env } from "../config/env.js";

import { publishResourceEvent } from "./resource.publisher.js";

import { normalizeResourceEvent } from "../../../../packages/kubernetes-observer/src/normalizer.js";

export class WatchManager {
  constructor({ kubeConfig, clusterId }) {
    this.kubeConfig = kubeConfig;

    this.clusterId = clusterId;

    this.watch = new k8s.Watch(kubeConfig);

    this.running = true;

    this.watchTasks = [];
  }

  async start() {
    this.watchTasks = [
      this.watchResource("/api/v1/pods"),

      this.watchResource("/api/v1/namespaces"),

      this.watchResource("/api/v1/nodes"),

      this.watchResource("/api/v1/events"),

      this.watchResource("/apis/apps/v1/deployments"),

      this.watchResource("/apis/apps/v1/replicasets"),

      this.watchResource("/api/v1/services"),
    ];

    await Promise.all(this.watchTasks);
  }

  async watchResource(path) {
    while (this.running) {
      try {
        console.log(`[Observer] Watching ${path}`);

        await this.watch.watch(
          path,
          {
            allowWatchBookmarks: true,
          },

          async (type, object) => {
            try {
              const event = normalizeResourceEvent({
                clusterId: this.clusterId,

                type,

                object,
              });

              await publishResourceEvent(event);
            } catch (error) {
              console.error("[Observer] Event processing error:", error);
            }
          },

          (error) => {
            if (error) {
              console.error(`[Observer] Watch error ${path}:`, error);
            }
          },
        );

        if (this.running) {
          console.warn(`[Observer] Watch ended ${path}. Reconnecting...`);

          await this.sleep(env.reconnectDelayMs);
        }
      } catch (error) {
        console.error(`[Observer] Watch failed ${path}:`, error);

        await this.sleep(env.reconnectDelayMs);
      }
    }
  }

  async stop() {
    this.running = false;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
