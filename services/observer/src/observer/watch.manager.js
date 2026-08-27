import * as k8s from "@kubernetes/client-node";

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
        console.log(
          `[Observer] Watching ${path}`
        );


        await this.watch.watch(
          path,

          {
            allowWatchBookmarks: true,
          },


          async (type, object) => {
            try {

              /*
               * Kubernetes watch can send
               * BOOKMARK/control events.
               *
               * These events are not actual
               * Kubernetes resources.
               */
              const kind = object?.kind;

              const name =
                object?.metadata?.name;


              /*
               * Ignore invalid/control events.
               */
              if (!kind || !name) {
                console.log(
                  `[Observer] Ignoring non-resource watch event: ${type}`
                );

                return;
              }


              /*
               * Normalize Kubernetes resource.
               */
              const event =
                normalizeResourceEvent({
                  clusterId:
                    this.clusterId,

                  type,

                  object,
                });


              /*
               * Publish normalized event
               * to NATS.
               */
              await publishResourceEvent(
                event
              );

            } catch (error) {

              console.error(
                "[Observer] Event processing error:",
                error
              );

            }
          },


          (error) => {

            if (error) {

              console.error(
                `[Observer] Watch error ${path}:`,
                error
              );

            }

          }
        );


        /*
         * Watch connection ended.
         *
         * Reconnect automatically.
         */
        if (this.running) {

          console.warn(
            `[Observer] Watch ended ${path}. Reconnecting...`
          );

          await this.sleep(
            env.reconnectDelayMs
          );

        }

      } catch (error) {

        console.error(
          `[Observer] Watch failed ${path}:`,
          error
        );


        /*
         * Prevent tight reconnect loops.
         */
        await this.sleep(
          env.reconnectDelayMs
        );

      }
    }
  }


  async stop() {
    this.running = false;

    console.log(
      "[Observer] Stopping WatchManager..."
    );
  }


  sleep(ms) {
    return new Promise(
      (resolve) =>
        setTimeout(resolve, ms)
    );
  }
}