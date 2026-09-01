import {
  collectPodEvidence,
  collectServiceEvidence,
  collectKubernetesEventEvidence,
} from "./evidence.collector.js";

import {
  createEvidence,
  findRelatedKubernetesEvents,
} from "./evidence.repository.js";

import {
  collectContainerLogs,
  buildContainerLogEvidence,
} from "./log.collector.js";

import { db } from "../config/database.js";

import { env } from "../config/env.js";

/**
 * Kubernetes waiting states where container logs
 * are normally unavailable because the container
 * has not successfully started.
 */
const LOG_UNAVAILABLE_REASONS = new Set([
  "ImagePullBackOff",
  "ErrImagePull",
  "InvalidImageName",
  "ContainerCreating",
  "CreateContainerConfigError",
  "CreateContainerError",
]);

/**
 * Extract the current waiting reason for a container.
 */
function getWaitingReason(container) {
  return container?.state?.waiting?.reason || null;
}

/**
 * Determine whether a log retrieval failure is an
 * expected condition rather than a real evidence error.
 */
function isExpectedLogUnavailable(error, container) {
  const waitingReason = getWaitingReason(container);

  if (LOG_UNAVAILABLE_REASONS.has(waitingReason)) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();

  /*
   * Kubernetes commonly returns a BadRequest
   * when asking for logs from a container that
   * has never started.
   */
  if (message.includes("is waiting to start")) {
    return true;
  }

  if (message.includes("trying and failing to pull image")) {
    return true;
  }

  return false;
}

/**
 * Build a non-failing evidence item explaining
 * why logs were unavailable.
 *
 * This is useful because "no logs" is itself
 * meaningful in ImagePullBackOff scenarios.
 */
function buildLogUnavailableEvidence({ pod, container, phase }) {
  return {
    type: "LOG_UNAVAILABLE",

    podName: pod.name,

    namespace: pod.namespace,

    containerName: container.name,

    reason: getWaitingReason(container),

    phase: phase || null,

    message:
      `Container ${container.name} has no ${phase === "previous" ? "previous" : "current"} ` +
      `logs available because the container has not successfully started.`,
  };
}

export async function collectIncidentEvidence({ incident, snapshot }) {
  if (!incident || !snapshot) {
    throw new Error("Incident and snapshot are required");
  }

  let evidence = [];

  /*
   * ==========================================
   * 1. Pod resource evidence
   * ==========================================
   */
  if (snapshot.kind === "Pod") {
    evidence.push(
      ...collectPodEvidence({
        incident,
        snapshot,
      }),
    );
  }

  if (snapshot.kind === "Service") {
    const endpointSlices = await findServiceEndpointSlices({
      clusterId: incident.cluster_id,

      serviceUid: snapshot.uid,
    });

    evidence.push(
      ...collectServiceEvidence({
        incident,

        snapshot,

        endpointSlices,
      }),
    );
  }

  /*
   * ==========================================
   * 2. Kubernetes Event evidence
   * ==========================================
   */
  const events = await findRelatedKubernetesEvents({
    clusterId: incident.cluster_id,

    resourceUid: snapshot.uid,
  });

  evidence.push(
    ...collectKubernetesEventEvidence({
      events,
    }),
  );

  /*
   * ==========================================
   * 3. Container logs
   * ==========================================
   */
  if (snapshot.kind === "Pod" && snapshot.namespace && snapshot.name) {
    const containers = snapshot.resource?.spec?.containers || [];

    const containerStatuses =
      snapshot.resource?.status?.containerStatuses || [];

    for (const container of containers) {
      const status = containerStatuses.find(
        (item) => item?.name === container.name,
      );

      /*
       * --------------------------------------
       * Current logs
       * --------------------------------------
       */
      try {
        const currentLogs = await collectContainerLogs({
          kubeContext: env.kubeContext,

          namespace: snapshot.namespace,

          podName: snapshot.name,

          containerName: container.name,

          previous: false,

          tailLines: 200,
        });

        if (currentLogs.logs) {
          evidence.push(
            buildContainerLogEvidence({
              pod: snapshot,

              logResult: currentLogs,

              previous: false,
            }),
          );
        }
      } catch (error) {
        /*
         * ImagePullBackOff/ErrImagePull/etc.
         * are expected to have no logs because
         * the container never successfully started.
         */
        if (isExpectedLogUnavailable(error, status)) {
          evidence.push(
            buildLogUnavailableEvidence({
              pod: snapshot,

              container,

              phase: "current",
            }),
          );
        } else {
          console.warn(
            `[Evidence] Could not collect current logs for ` +
              `${snapshot.name}/${container.name}: ` +
              error.message,
          );
        }
      }

      /*
       * --------------------------------------
       * Previous container logs
       * --------------------------------------
       */
      try {
        const previousLogs = await collectContainerLogs({
          kubeContext: env.kubeContext,

          namespace: snapshot.namespace,

          podName: snapshot.name,

          containerName: container.name,

          previous: true,

          tailLines: 200,
        });

        if (previousLogs.logs) {
          evidence.push(
            buildContainerLogEvidence({
              pod: snapshot,

              logResult: previousLogs,

              previous: true,
            }),
          );
        }
      } catch (error) {
        /*
         * A previous container may not exist.
         *
         * For example:
         *
         * ImagePullBackOff
         * restartCount = 0
         */
        if (isExpectedLogUnavailable(error, status)) {
          /*
           * Don't create duplicate LOG_UNAVAILABLE
           * evidence for previous logs when the
           * container has never started.
           *
           * The current-log evidence already explains
           * the condition.
           */
        } else {
          /*
           * Previous logs are optional evidence.
           * We deliberately don't fail the entire
           * evidence collection because they aren't
           * available.
           */
        }
      }
    }
  }

  /*
   * ==========================================
   * 4. Persist evidence
   * ==========================================
   */
  const saved = [];

  for (const item of evidence) {
    const row = await createEvidence({
      incidentId: incident.id,

      clusterId: incident.cluster_id,

      evidence: item,
    });

    saved.push(row);
  }

  console.log(
    `[Evidence] Collected ` +
      `${saved.length} evidence items ` +
      `for incident ${incident.id}`,
  );

  return saved;
}


async function findServiceEndpointSlices({
  clusterId,
  serviceUid,
  serviceName,
}) {
  const result =
    await db.query(
      `
      SELECT
        uid,
        kind,
        name,
        namespace,
        resource
      FROM resource_snapshots
      WHERE
        cluster_id = $1
        AND kind = 'EndpointSlice'
      `,
      [
        clusterId,
      ],
    );


  return result.rows.filter(
    (row) => {
      const raw =
        row.resource?.raw ||
        row.resource ||
        {};

      const owners =
        raw.metadata
          ?.ownerReferences ||
        [];

      const labels =
        raw.metadata?.labels ||
        {};


      return (
        owners.some(
          (owner) =>
            owner.uid ===
            serviceUid,
        ) ||
        labels[
          "kubernetes.io/service-name"
        ] ===
          serviceName
      );
    },
  );
}