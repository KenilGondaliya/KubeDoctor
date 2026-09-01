import { detectIncident, isIncidentResolved } from "./incident.detector.js";

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

/**
 * Load current Kubernetes snapshots for a cluster.
 */
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
 * Resolve the logical workload for a resource.
 *
 * Example:
 *
 * Pod
 *  ↓
 * ReplicaSet
 *  ↓
 * Deployment
 *
 * Because reconciliation can temporarily store
 * the Pod before its owners, retry briefly.
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

    if (workload?.uid && workload.kind !== "Pod") {
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
 * Check whether another Pod belonging to the
 * same workload is currently in CrashLoopBackOff.
 */
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

/**
 * Convert event into evidence snapshot format.
 */
function buildEvidenceSnapshot(event) {
  return {
    uid: event.resource.uid,

    kind: event.resource.kind,

    name: event.resource.name,

    namespace: event.resource.namespace,

    labels: event.resource.labels,

    resource_version: event.resource.resourceVersion,

    resource: event.resource,
  };
}

/**
 * Process one normalized Kubernetes event.
 */
export async function processResourceEvent(event) {
  /*
   * =========================================
   * Basic validation
   * =========================================
   */
  if (!event?.clusterId || !event?.resource) {
    return {
      detected: false,
      incident: null,
    };
  }

  const kubernetesEvents = await loadRelatedKubernetesEvents({
    clusterId: event.clusterId,

    resourceUid: event.resource.uid,
  });
  let detectionEvent = event;

  if (event.resource.kind === "Service") {
    const endpointSlices = await loadServiceEndpointSlices({
      clusterId: event.clusterId,

      serviceUid: event.resource.uid,
    });

    detectionEvent = {
      ...event,

      endpointSlices,
    };
  }

  /*
   * =========================================
   * 1. DETECT CURRENT INCIDENT FIRST
   * =========================================
   *
   * This is critical.
   *
   * An ImagePullBackOff Pod must not be treated
   * as a resolved CrashLoop just because it is
   * no longer waiting for CrashLoopBackOff.
   */
  const incident = detectIncident(detectionEvent);

  /*
   * =========================================
   * 2. Resolve workload identity
   * =========================================
   */
  const workload = await resolveWorkloadWithRetry({
    event,
  });

  /*
   * =========================================
   * 3. RESOLUTION
   * =========================================
   *
   * We only attempt CrashLoop resolution when
   * there is NO currently detected incident.
   *
   * Therefore:
   *
   * CrashLoopBackOff → incident exists
   * OOMKilled         → incident exists
   * ImagePullBackOff  → incident exists
   * Healthy Pod       → no incident → resolution check
   */
  if (
    !incident &&
    event.resource.kind === "Pod" &&
    workload?.uid &&
    isIncidentResolved(event, "POD_CRASH_LOOP")
  ) {
    const anotherCrashLoop = await hasActiveCrashLoopForWorkload({
      clusterId: event.clusterId,

      workloadUid: workload.uid,
    });

    /*
     * One healthy Pod does not mean the whole
     * workload is healthy.
     */
    if (anotherCrashLoop) {
      console.log(
        `[Incident] Not resolving ` +
          `POD_CRASH_LOOP for ` +
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
   * =========================================
   * 4. No incident
   * =========================================
   */
  if (!incident) {
    return {
      detected: false,

      incident: null,
    };
  }

  /*
   * =========================================
   * 5. Find existing OPEN incident
   * =========================================
   */
  const existing = workload?.uid
    ? await findOpenIncidentByWorkload({
        clusterId: event.clusterId,

        workloadUid: workload.uid,

        incidentType: incident.incidentType,
      })
    : null;

  /*
   * =========================================
   * 6. Existing incident → UPDATE
   * =========================================
   */
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
   * =========================================
   * 7. Find previously RESOLVED incident
   * =========================================
   */
  const resolved = workload?.uid
    ? await findResolvedIncidentByWorkload({
        clusterId: event.clusterId,

        workloadUid: workload.uid,

        incidentType: incident.incidentType,
      })
    : null;

  /*
   * =========================================
   * 8. Resolved incident → REOPEN
   * =========================================
   */
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
     * Fresh evidence.
     */
    try {
      await collectIncidentEvidence({
        incident: reopened,

        snapshot: buildEvidenceSnapshot(event),
      });
    } catch (error) {
      console.error(
        `[Incident] Evidence collection failed ` +
          `for reopened incident ${reopened.id}:`,
        error,
      );
    }

    /*
     * Re-run diagnosis.
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
   * =========================================
   * 9. Create new incident
   * =========================================
   */
  const created = await createIncident({
    clusterId: event.clusterId,

    incident,

    workload,
  });

  /*
   * =========================================
   * 10. Collect evidence
   * =========================================
   */
  try {
    await collectIncidentEvidence({
      incident: created,

      snapshot: buildEvidenceSnapshot(event),
    });
  } catch (error) {
    console.error(
      `[Incident] Evidence collection failed ` + `for incident ${created.id}:`,
      error,
    );
  }

  /*
   * =========================================
   * 11. Run diagnosis
   * =========================================
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

  /*
   * =========================================
   * 12. Final log
   * =========================================
   */
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
async function loadRelatedKubernetesEvents({ clusterId, resourceUid }) {
  const result = await db.query(
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
      AND kind = 'Event'
    ORDER BY updated_at DESC
    LIMIT 500
    `,
    [clusterId],
  );

  return result.rows.filter((row) => {
    const rawEvent = row.resource?.raw || row.resource || {};

    const involvedObject = rawEvent.involvedObject || {};

    return involvedObject.uid === resourceUid;
  });
}

async function loadServiceEndpointSlices({ clusterId, serviceUid }) {
  const result = await db.query(
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
    [clusterId],
  );

  return result.rows.filter((row) => {
    const raw = row.resource?.raw || row.resource || {};

    const owners = raw.metadata?.ownerReferences || [];

    /*
     * Preferred relationship:
     * EndpointSlice owned by Service.
     */
    return owners.some((owner) => owner.uid === serviceUid);
  });
}
