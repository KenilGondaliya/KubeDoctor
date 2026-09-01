import * as k8s from "@kubernetes/client-node";

import { env } from "../config/env.js";

import { publishResourceEvent } from "./resource.publisher.js";

import { normalizeResourceEvent } from "../../../../packages/kubernetes-observer/src/normalizer.js";


export class WatchManager {
  constructor({
    kubeConfig,
    clusterId,
  }) {
    this.kubeConfig = kubeConfig;

    this.clusterId = clusterId;

    this.watch =
      new k8s.Watch(
        kubeConfig,
      );

    this.running = true;

    this.watchTasks = [];
  }


  async start() {
    this.running = true;

    this.watchTasks = [
      this.watchResource(
        "/api/v1/pods",
      ),

      this.watchResource(
        "/api/v1/namespaces",
      ),

      this.watchResource(
        "/api/v1/nodes",
      ),

      this.watchResource(
        "/api/v1/events",
      ),

      this.watchResource(
        "/api/v1/services",
      ),

      this.watchResource(
        "/apis/apps/v1/deployments",
      ),

      this.watchResource(
        "/apis/apps/v1/replicasets",
      ),

      /*
       * EndpointSlice is required for modern
       * Service endpoint discovery.
       */
      this.watchResource(
        "/apis/discovery.k8s.io/v1/endpointslices",
      ),
    ];

    await Promise.all(
      this.watchTasks,
    );
  }


  async watchResource(
    path,
  ) {
    while (this.running) {
      try {
        console.log(
          `[Observer] Watching ${path}`,
        );


        await this.watch.watch(
          path,

          {
            allowWatchBookmarks:
              true,
          },

          async (
            type,
            object,
          ) => {
            try {
              /*
               * Ignore Kubernetes control/bookmark
               * events that don't represent an object.
               */
              const kind =
                object?.kind;

              const name =
                object?.metadata?.name;


              if (
                !kind ||
                !name
              ) {
                console.log(
                  `[Observer] Ignoring non-resource watch event: ${type}`,
                );

                return;
              }


              const event =
                normalizeResourceEvent({
                  clusterId:
                    this.clusterId,

                  type,

                  object,
                });


              await publishResourceEvent(
                event,
              );

            } catch (error) {
              console.error(
                "[Observer] Event processing error:",
                error,
              );
            }
          },

          (error) => {
            if (error) {
              console.error(
                `[Observer] Watch error ${path}:`,
                error,
              );
            }
          },
        );


        /*
         * Watch connection ended.
         * Reconnect automatically.
         */
        if (this.running) {
          console.warn(
            `[Observer] Watch ended ${path}. Reconnecting...`,
          );

          await this.sleep(
            env.reconnectDelayMs,
          );
        }

      } catch (error) {
        console.error(
          `[Observer] Watch failed ${path}:`,
          error,
        );

        await this.sleep(
          env.reconnectDelayMs,
        );
      }
    }
  }


  async stop() {
    this.running = false;

    console.log(
      "[Observer] Stopping WatchManager...",
    );
  }


  sleep(ms) {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          ms,
        ),
    );
  }
}