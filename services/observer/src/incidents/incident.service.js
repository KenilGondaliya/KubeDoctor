import { detectIncident, isCrashLoopResolved } from "./incident.detector.js";

import { db } from "../config/database.js";

import { resolveWorkloadIdentity } from "./workload.resolver.js";

import {
  findOpenIncidentByWorkload,
  findResolvedIncidentByWorkload,
  createIncident,
  updateIncident,
  reopenIncident,
  resolveIncidentByWorkload,
} from "./incident.repository.js";

import { collectIncidentEvidence } from "../evidence/evidence.service.js";

import { runDiagnosis } from "../diagnosis/diagnosis.service.js";

async function loadClusterResources(clusterId) {
  const result = await db.query(
    `
      SELECT
        uid,
        kind,
        name,
        namespace,
        resource,
        labels,
        annotations
      FROM resource_snapshots
      WHERE cluster_id = $1
      `,
    [clusterId],
  );

  return result.rows;
}

/**
 * Resolve workload identity.
 *
 * Reconciliation publishes Pods before ReplicaSets
 * and Deployments, so retry briefly while the
 * ownership chain becomes available in snapshots.
 */
async function resolveWorkloadWithRetry({
  event,
  attempts = 5,
  delayMs = 500,
}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const resources = await loadClusterResources(event.clusterId);

    const workload = resolveWorkloadIdentity({
      resource: {
        uid: event.resource.uid,

        kind: event.resource.kind,

        name: event.resource.name,

        metadata: event.resource.metadata,

        resource: event.resource,
      },

      resources,
    });

    /*
     * We successfully resolved the resource
     * to a workload.
     */
    if (workload && workload.uid && workload.kind !== "Pod") {
      return workload;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  /*
   * Standalone resource fallback.
   */
  return {
    uid: event.resource.uid,

    kind: event.resource.kind,

    name: event.resource.name,
  };
}

/**
 * Process one normalized Kubernetes event.
 */
export async function processResourceEvent(event) {
  if (!event?.clusterId || !event?.resource) {
    return {
      detected: false,

      incident: null,
    };
  }

  /*
   * ---------------------------------------
   * Resolve logical workload
   * ---------------------------------------
   */

  const workload = await resolveWorkloadWithRetry({
    event,
  });

  /*
   * ---------------------------------------
   * CrashLoop resolution
   * ---------------------------------------
   *
   * Important:
   *
   * We resolve against the workload identity,
   * not the Pod UID.
   */

  if (
    event.resource.kind === "Pod" &&
    isCrashLoopResolved(event) &&
    workload?.uid
  ) {
    const anotherCrashLoop = await hasActiveCrashLoopForWorkload({
      clusterId: event.clusterId,

      workloadUid: workload.uid,
    });

    /*
     * A healthy Pod does NOT mean the workload
     * is healthy if another Pod is still crashing.
     */
    if (anotherCrashLoop) {
      console.log(
        `[Incident] Not resolving ` +
          `POD_CRASH_LOOP for workload ` +
          `${workload.kind}/${workload.name} ` +
          `because another Pod is still crashing`,
      );

      return {
        detected: false,

        resolved: false,

        incident: null,
      };
    }

    const resolved = await resolveIncidentByWorkload({
      clusterId: event.clusterId,

      workloadUid: workload.uid,

      incidentType: "POD_CRASH_LOOP",
    });

    if (resolved) {
      console.log(
        `[Incident] RESOLVED ` +
          `${resolved.incident_type} ` +
          `${resolved.resource_kind}/` +
          `${resolved.resource_name}`,
      );
    }

    return {
      detected: false,

      resolved: Boolean(resolved),

      incident: resolved,
    };
  }

  /*
   * ---------------------------------------
   * Detect incident
   * ---------------------------------------
   */

  const incident = detectIncident(event);

  if (!incident) {
    return {
      detected: false,

      incident: null,
    };
  }

  /*
   * ---------------------------------------
   * Existing active incident
   * ---------------------------------------
   */

  const existing = workload?.uid
    ? await findOpenIncidentByWorkload({
        clusterId: event.clusterId,

        workloadUid: workload.uid,

        incidentType: incident.incidentType,
      })
    : null;

  if (existing) {
    const updated = await updateIncident({
      incidentId: existing.id,

      incident,
    });

    console.log(
      `[Incident] Updated ` +
        `${incident.incidentType} ` +
        `${incident.resourceKind}/` +
        `${incident.resourceName}`,
    );

    return {
      detected: true,

      created: false,

      updated: true,

      reopened: false,

      incident: updated,
    };
  }

  /*
   * ---------------------------------------
   * Previously resolved incident
   * ---------------------------------------
   */

  const resolved = workload?.uid
    ? await findResolvedIncidentByWorkload({
        clusterId: event.clusterId,

        workloadUid: workload.uid,

        incidentType: incident.incidentType,
      })
    : null;

  if (resolved) {
    const reopened = await reopenIncident({
      incidentId: resolved.id,

      incident,
    });

    console.log(
      `[Incident] REOPENED ` +
        `${incident.incidentType} ` +
        `${incident.resourceKind}/` +
        `${incident.resourceName}`,
    );

    /*
     * Collect fresh evidence for the new
     * occurrence.
     */
    try {
      await collectIncidentEvidence({
        incident: reopened,

        snapshot: {
          uid: event.resource.uid,

          kind: event.resource.kind,

          name: event.resource.name,

          namespace: event.resource.namespace,

          labels: event.resource.labels,

          resource_version: event.resource.resourceVersion,

          resource: event.resource,
        },
      });
    } catch (error) {
      console.error(
        `[Incident] Evidence collection failed ` +
          `for reopened incident ${reopened.id}:`,
        error,
      );
    }

    /*
     * Re-run diagnosis using the new evidence.
     */
    try {
      const diagnosis = await runDiagnosis(reopened);

      console.log(
        `[Diagnosis] Updated ` +
          `${diagnosis.primary_cause} ` +
          `confidence=${diagnosis.confidence}`,
      );
    } catch (error) {
      console.error(
        `[Diagnosis] Failed for reopened incident ` + `${reopened.id}:`,
        error,
      );
    }

    return {
      detected: true,

      created: false,

      updated: false,

      reopened: true,

      incident: reopened,
    };
  }

  /*
   * ---------------------------------------
   * Completely new incident
   * ---------------------------------------
   */

  const created = await createIncident({
    clusterId: event.clusterId,

    incident,

    workload,
  });

  /*
   * ---------------------------------------
   * Initial evidence
   * ---------------------------------------
   */

  try {
    await collectIncidentEvidence({
      incident: created,

      snapshot: {
        uid: event.resource.uid,

        kind: event.resource.kind,

        name: event.resource.name,

        namespace: event.resource.namespace,

        labels: event.resource.labels,

        resource_version: event.resource.resourceVersion,

        resource: event.resource,
      },
    });
  } catch (error) {
    console.error(
      `[Incident] Evidence collection failed ` + `for ${created.id}:`,
      error,
    );
  }

  /*
   * ---------------------------------------
   * Initial diagnosis
   * ---------------------------------------
   */

  try {
    const diagnosis = await runDiagnosis(created);

    console.log(
      `[Diagnosis] Created ` +
        `${diagnosis.primary_cause} ` +
        `confidence=${diagnosis.confidence}`,
    );
  } catch (error) {
    console.error(`[Diagnosis] Failed for incident ` + `${created.id}:`, error);
  }

  console.log(
    `[Incident] CREATED ` +
      `${created.incident_type} ` +
      `${created.resource_kind}/` +
      `${created.resource_name}`,
  );

  return {
    detected: true,

    created: true,

    updated: false,

    reopened: false,

    incident: created,
  };
}
async function hasActiveCrashLoopForWorkload({ clusterId, workloadUid }) {
  const resources = await loadClusterResources(clusterId);

  for (const resource of resources) {
    if (resource.kind !== "Pod") {
      continue;
    }

    const workload = resolveWorkloadIdentity({
      resource,

      resources,
    });

    if (workload?.uid !== workloadUid) {
      continue;
    }

    const containerStatuses =
      resource.resource?.status?.containerStatuses || [];

    const crashing = containerStatuses.some(
      (container) => container?.state?.waiting?.reason === "CrashLoopBackOff",
    );

    if (crashing) {
      return true;
    }
  }

  return false;
}
