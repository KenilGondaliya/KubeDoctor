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
  constructor({
    kubeContext,
    clusterId,
    intervalMs,
  }) {
    this.kubeContext =
      kubeContext;

    this.clusterId =
      clusterId;

    this.intervalMs =
      intervalMs;

    this.running =
      false;

    this.timer =
      null;
  }


  async reconcile() {
    console.log(
      `[Reconciler] Reconciling ${this.clusterId}`,
    );


    const coreApi =
      createCoreApi(
        this.kubeContext,
      );

    const appsApi =
      createAppsApi(
        this.kubeContext,
      );

    const discoveryApi =
      createDiscoveryApi(
        this.kubeContext,
      );


    const [
      pods,
      namespaces,
      nodes,
      services,
      deployments,
      replicasets,
      endpointSlices,
    ] =
      await Promise.all([
        coreApi.listPodForAllNamespaces(),

        coreApi.listNamespace(),

        coreApi.listNode(),

        coreApi.listServiceForAllNamespaces(),

        appsApi.listDeploymentForAllNamespaces(),

        appsApi.listReplicaSetForAllNamespaces(),

        discoveryApi.listEndpointSliceForAllNamespaces(),
      ]);


    const podItems =
      pods.body?.items ??
      pods.items ??
      [];

    const namespaceItems =
      namespaces.body?.items ??
      namespaces.items ??
      [];

    const nodeItems =
      nodes.body?.items ??
      nodes.items ??
      [];

    const serviceItems =
      services.body?.items ??
      services.items ??
      [];

    const deploymentItems =
      deployments.body?.items ??
      deployments.items ??
      [];

    const replicaSetItems =
      replicasets.body?.items ??
      replicasets.items ??
      [];

    const endpointSliceItems =
      endpointSlices.body?.items ??
      endpointSlices.items ??
      [];


    /*
     * =========================================
     * Current-state snapshots
     * =========================================
     */
    await this.publishSnapshot(
      "Pod",
      podItems,
    );

    await this.publishSnapshot(
      "Namespace",
      namespaceItems,
    );

    await this.publishSnapshot(
      "Node",
      nodeItems,
    );

    await this.publishSnapshot(
      "Service",
      serviceItems,
    );

    await this.publishSnapshot(
      "Deployment",
      deploymentItems,
    );

    await this.publishSnapshot(
      "ReplicaSet",
      replicaSetItems,
    );

    await this.publishSnapshot(
      "EndpointSlice",
      endpointSliceItems,
    );


    /*
     * =========================================
     * Remove deleted Pods
     * =========================================
     */
    await pruneSnapshots(
      this.clusterId,
      "Pod",
      podItems,
    );


    /*
     * =========================================
     * Remove deleted Services
     * =========================================
     */
    await pruneSnapshots(
      this.clusterId,
      "Service",
      serviceItems,
    );


    /*
     * =========================================
     * Remove deleted Deployments
     * =========================================
     */
    await pruneSnapshots(
      this.clusterId,
      "Deployment",
      deploymentItems,
    );


    /*
     * =========================================
     * Remove deleted ReplicaSets
     * =========================================
     */
    await pruneSnapshots(
      this.clusterId,
      "ReplicaSet",
      replicaSetItems,
    );


    /*
     * =========================================
     * Remove deleted EndpointSlices
     * =========================================
     */
    await pruneSnapshots(
      this.clusterId,
      "EndpointSlice",
      endpointSliceItems,
    );


    /*
     * =========================================
     * Rebuild topology
     * =========================================
     */
    await rebuildTopology(
      this.clusterId,
    );


    console.log(
      `[Reconciler] Completed ${this.clusterId}`,
    );
  }


  async publishSnapshot(
    kind,
    resources,
  ) {
    console.log(
      `[Reconciler] Publishing ${kind}: ${resources.length} resources`,
    );


    for (
      const object
      of resources
    ) {
      const event =
        normalizeResourceEvent({
          clusterId:
            this.clusterId,

          type:
            "RECONCILE",

          object,
        });


      await publishResourceEvent(
        event,
      );
    }
  }


  async start() {
    this.running =
      true;

    await this.reconcile();


    this.timer =
      setInterval(
        () => {
          this.reconcile().catch(
            (error) => {
              console.error(
                "[Reconciler] Failed:",
                error,
              );
            },
          );
        },

        this.intervalMs,
      );
  }


  stop() {
    this.running =
      false;


    if (this.timer) {
      clearInterval(
        this.timer,
      );

      this.timer =
        null;
    }
  }
}


async function pruneSnapshots(
  clusterId,
  kind,
  currentResources,
) {
  const currentUids =
    currentResources
      .map(
        (resource) =>
          resource?.metadata?.uid,
      )
      .filter(Boolean);


  /*
   * If Kubernetes currently has no objects
   * of this kind, remove all stored snapshots.
   */
  if (
    currentUids.length === 0
  ) {
    await db.query(
      `
      DELETE FROM resource_snapshots
      WHERE
        cluster_id = $1
        AND kind = $2
      `,
      [
        clusterId,
        kind,
      ],
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
    [
      clusterId,
      kind,
      currentUids,
    ],
  );
}