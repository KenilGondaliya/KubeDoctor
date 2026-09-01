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

    const podItems = podsResponse?.body?.items ?? podsResponse?.items ?? [];

    const namespaceItems =
      namespacesResponse?.body?.items ?? namespacesResponse?.items ?? [];

    const nodeItems = nodesResponse?.body?.items ?? nodesResponse?.items ?? [];

    const serviceItems =
      servicesResponse?.body?.items ?? servicesResponse?.items ?? [];

    const deploymentItems =
      deploymentsResponse?.body?.items ?? deploymentsResponse?.items ?? [];

    const replicaSetItems =
      replicasetsResponse?.body?.items ?? replicasets?.items ?? [];

    const endpointSliceItems =
      endpointSlicesResponse?.body?.items ??
      endpointSlicesResponse?.items ??
      [];

    /*
     * =========================================
     * Publish current Kubernetes state
     * =========================================
     */

    await this.publishSnapshot("Pod", podItems);

    await this.publishSnapshot("Namespace", namespaceItems);

    await this.publishSnapshot("Node", nodeItems);

    await this.publishSnapshot("Service", serviceItems);

    await this.publishSnapshot("Deployment", deploymentItems);

    await this.publishSnapshot("ReplicaSet", replicaSetItems);

    await this.publishSnapshot("EndpointSlice", endpointSliceItems);

    /*
     * =========================================
     * Remove stale snapshots
     * =========================================
     */

    await pruneSnapshots(this.clusterId, "Pod", podItems);

    await pruneSnapshots(this.clusterId, "Namespace", namespaceItems);

    await pruneSnapshots(this.clusterId, "Node", nodeItems);

    await pruneSnapshots(this.clusterId, "Service", serviceItems);

    await pruneSnapshots(this.clusterId, "Deployment", deploymentItems);

    await pruneSnapshots(this.clusterId, "ReplicaSet", replicaSetItems);

    await pruneSnapshots(this.clusterId, "EndpointSlice", endpointSliceItems);

    /*
     * =========================================
     * Rebuild topology after snapshots are
     * completely refreshed.
     * =========================================
     */

    await rebuildTopology(this.clusterId);

    console.log(`[Reconciler] Completed ${this.clusterId}`);
  }

  async publishSnapshot(kind, resources) {
    if (!Array.isArray(resources)) {
      console.warn(`[Reconciler] ${kind} resources is not an array`);

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
       * Some Kubernetes client responses do not
       * contain top-level `kind`.
       *
       * The collection itself tells us what kind
       * this object is, so inject it explicitly.
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

      /*
       * Defensive validation.
       */
      if (!event?.resource?.kind) {
        console.warn(
          `[Reconciler] Skipping ${kind} resource without resolved kind: ${
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

    this.timer = setInterval(
      () => {
        if (!this.running) {
          return;
        }

        this.reconcile().catch((error) => {
          console.error("[Reconciler] Reconciliation failed:", error);
        });
      },

      this.intervalMs,
    );
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

/*
 * ===========================================
 * Remove stale snapshots
 * ===========================================
 */
async function pruneSnapshots(clusterId, kind, currentResources) {
  if (!Array.isArray(currentResources)) {
    return;
  }

  const currentUids = currentResources
    .map((resource) => resource?.metadata?.uid)
    .filter(Boolean);

  /*
   * Kubernetes currently has no resources
   * of this kind.
   */
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
