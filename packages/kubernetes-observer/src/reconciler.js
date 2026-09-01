import {
  createCoreApi,
  createAppsApi,
  createDiscoveryApi,
} from "../config/kubernetes.js";

import { normalizeResourceEvent } from "../../../../packages/kubernetes-observer/src/normalizer.js";

import { publishResourceEvent } from "./resource.publisher.js";

import { rebuildTopology } from "../topology/topology.service.js";

import { db } from "../config/database.js";

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

    const discoveryApi = createDiscoveryApi(this.kubeContext);

    const [
      podsResponse,
      namespacesResponse,
      nodesResponse,
      servicesResponse,
      deploymentsResponse,
      replicasetsResponse,
      endpointSlicesResponse,
    ] = await Promise.all([
      coreApi.listPodForAllNamespaces(),

      coreApi.listNamespace(),

      coreApi.listNode(),

      coreApi.listServiceForAllNamespaces(),

      appsApi.listDeploymentForAllNamespaces(),

      appsApi.listReplicaSetForAllNamespaces(),

      discoveryApi.listEndpointSliceForAllNamespaces(),
    ]);

    const pods = podsResponse?.body?.items ?? podsResponse?.items ?? [];

    const namespaces =
      namespacesResponse?.body?.items ?? namespacesResponse?.items ?? [];

    const nodes = nodesResponse?.body?.items ?? nodesResponse?.items ?? [];

    const services =
      servicesResponse?.body?.items ?? servicesResponse?.items ?? [];

    const deployments =
      deploymentsResponse?.body?.items ?? deploymentsResponse?.items ?? [];

    const replicasets =
      replicasetsResponse?.body?.items ?? replicasetsResponse?.items ?? [];

    const endpointSlices =
      endpointSlicesResponse?.body?.items ??
      endpointSlicesResponse?.items ??
      [];

    await this.publishSnapshot("Pod", pods);

    await this.publishSnapshot("Namespace", namespaces);

    await this.publishSnapshot("Node", nodes);

    await this.publishSnapshot("Service", services);

    await this.publishSnapshot("Deployment", deployments);

    await this.publishSnapshot("ReplicaSet", replicasets);

    await this.publishSnapshot("EndpointSlice", endpointSlices);

    await pruneSnapshots(this.clusterId, "Pod", pods);

    await pruneSnapshots(this.clusterId, "Namespace", namespaces);

    await pruneSnapshots(this.clusterId, "Node", nodes);

    await pruneSnapshots(this.clusterId, "Service", services);

    await pruneSnapshots(this.clusterId, "Deployment", deployments);

    await pruneSnapshots(this.clusterId, "ReplicaSet", replicasets);

    await pruneSnapshots(this.clusterId, "EndpointSlice", endpointSlices);

    await rebuildTopology(this.clusterId);

    console.log(`[Reconciler] Completed ${this.clusterId}`);
  }

  async publishSnapshot(kind, resources) {
    if (!Array.isArray(resources)) {
      console.warn(`[Reconciler] Invalid ${kind} resource list`);
      return;
    }

    console.log(
      `[Reconciler] Publishing ${kind}: ${resources.length} resources`,
    );

    for (const object of resources) {
      if (!object) {
        continue;
      }

      /*
       * IMPORTANT:
       *
       * Some Kubernetes client responses do not
       * contain a top-level `kind`.
       *
       * Inject it directly into the object so
       * both the normalizer and downstream code
       * always receive it.
       */
      const normalizedObject = {
        ...object,

        kind: object?.kind || kind,
      };

      const event = normalizeResourceEvent({
        clusterId: this.clusterId,

        type: "RECONCILE",

        kind,

        object: normalizedObject,
      });

      if (!event?.resource?.kind) {
        console.warn(
          `[Reconciler] Skipping ${kind} resource without kind: ${
            object?.metadata?.name || "unknown"
          }`,
        );

        continue;
      }

      if (!event?.resource?.name) {
        console.warn(`[Reconciler] Skipping ${kind} resource without name`);

        continue;
      }

      await publishResourceEvent(event);
    }
  }

  async start() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.reconcile();
    } catch (error) {
      console.error("[Reconciler] Initial reconciliation failed:", error);
    }

    this.timer = setInterval(() => {
      if (!this.running) {
        return;
      }

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

    console.log("[Reconciler] Stopped");
  }
}

async function pruneSnapshots(clusterId, kind, currentResources) {
  if (!Array.isArray(currentResources)) {
    return;
  }

  const currentUids = currentResources
    .map((resource) => resource?.metadata?.uid)
    .filter(Boolean);

  if (currentUids.length === 0) {
    await db.query(
      `
      DELETE FROM resource_snapshots
      WHERE
        cluster_id = $1
        AND kind = $2
      `,
      [clusterId, kind],
    );

    return;
  }

  await db.query(
    `
    DELETE FROM resource_snapshots
    WHERE
      cluster_id = $1
      AND kind = $2
      AND NOT (
        uid = ANY($3::text[])
      )
    `,
    [clusterId, kind, currentUids],
  );
}
