import { createCoreApi, createAppsApi } from "../config/kubernetes.js";

import { normalizeResourceEvent } from "../../../../packages/kubernetes-observer/src/normalizer.js";

import { publishResourceEvent } from "./resource.publisher.js";

export class Reconciler {
  constructor({ kubeContext, clusterId, intervalMs }) {
    this.kubeContext = kubeContext;

    this.clusterId = clusterId;

    this.intervalMs = intervalMs;

    this.running = false;

    this.timer = null;
  }

  async reconcile() {
    console.log(`[Reconciler] Reconciling ${this.clusterId}`);

    const coreApi = createCoreApi(this.kubeContext);

    const appsApi = createAppsApi(this.kubeContext);

    const [pods, namespaces, nodes, services, deployments, replicasets] =
      await Promise.all([
        coreApi.listPodForAllNamespaces(),

        coreApi.listNamespace(),

        coreApi.listNode(),

        coreApi.listServiceForAllNamespaces(),

        appsApi.listDeploymentForAllNamespaces(),

        appsApi.listReplicaSetForAllNamespaces(),
      ]);

    await this.publishSnapshot("Pod", pods.body?.items ?? pods.items ?? []);

    await this.publishSnapshot(
      "Namespace",
      namespaces.body?.items ?? namespaces.items ?? [],
    );

    await this.publishSnapshot("Node", nodes.body?.items ?? nodes.items ?? []);

    await this.publishSnapshot(
      "Service",
      services.body?.items ?? services.items ?? [],
    );

    await this.publishSnapshot(
      "Deployment",
      deployments.body?.items ?? deployments.items ?? [],
    );

    await this.publishSnapshot(
      "ReplicaSet",
      replicasets.body?.items ?? replicasets.items ?? [],
    );

    console.log(`[Reconciler] Completed ${this.clusterId}`);
  }

  async publishSnapshot(kind, resources) {
    console.log(
      `[Reconciler] Publishing ${kind}: ${resources.length} resources`,
    );

    for (const object of resources) {
      const event = normalizeResourceEvent({
        clusterId: this.clusterId,
        type: "RECONCILE",
        kind,
        object,
      });

      console.log("[Reconciler] Event resource:", event.resource);

      await publishResourceEvent(event);
    }
  }

  async start() {
    this.running = true;

    await this.reconcile();

    this.timer = setInterval(() => {
      this.reconcile().catch((error) => {
        console.error("[Reconciler] Failed:", error);
      });
    }, this.intervalMs);
  }

  stop() {
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);

      this.timer = null;
    }
  }
}
