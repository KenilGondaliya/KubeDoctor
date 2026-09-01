import { db } from "../config/database.js";

import { findTopologyChildren } from "../topology/topology.repository.js";

const MAX_DEPTH = 10;

const SEVERITY_RANK = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

async function loadIncident(incidentId) {
  const result = await db.query(
    `
    SELECT
      id,
      cluster_id,
      resource_uid,
      resource_kind,
      resource_name,
      namespace,
      incident_type,
      severity,
      status,
      workload_uid,
      workload_kind,
      workload_name
    FROM incidents
    WHERE id = $1
    LIMIT 1
    `,
    [incidentId],
  );

  return result.rows[0] || null;
}

async function loadDiagnosis(incidentId) {
  const result = await db.query(
    `
    SELECT
      id,
      incident_id,
      status,
      primary_cause,
      confidence,
      summary,
      reasoning
    FROM diagnoses
    WHERE incident_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [incidentId],
  );

  return result.rows[0] || null;
}

async function findActiveIncidentForResource({ clusterId, resourceUid }) {
  const result = await db.query(
    `
    SELECT
      id,
      cluster_id,
      resource_uid,
      resource_kind,
      resource_name,
      namespace,
      incident_type,
      severity,
      status,
      workload_uid,
      workload_kind,
      workload_name
    FROM incidents
    WHERE
      cluster_id = $1
      AND resource_uid = $2
      AND status != 'RESOLVED'
    ORDER BY
      CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END,
      last_seen_at DESC
    LIMIT 1
    `,
    [clusterId, resourceUid],
  );

  return result.rows[0] || null;
}

function sortIncidents(items) {
  return items.sort((a, b) => {
    const rankA = SEVERITY_RANK[a.incident.severity] || 5;

    const rankB = SEVERITY_RANK[b.incident.severity] || 5;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return (
      Number(b.relationshipConfidence || 0) -
      Number(a.relationshipConfidence || 0)
    );
  });
}

/**
 * Resolve a causal chain through the
 * Kubernetes topology.
 *
 * Example:
 *
 * Deployment
 *   ↓ OWNS
 * ReplicaSet
 *   ↓ OWNS
 * Pod
 *   ↓
 * Incident
 *   ↓
 * Diagnosis
 */
export async function resolveCausalChain({ incidentId, maxDepth = MAX_DEPTH }) {
  const chain = [];

  const visitedIncidents = new Set();

  const visitedResources = new Set();

  const resourceQueue = [];

  const rootIncident = await loadIncident(incidentId);

  if (!rootIncident) {
    return chain;
  }

  /*
   * -----------------------------------------
   * Add root incident
   * -----------------------------------------
   */
  chain.push({
    type: "INCIDENT",

    incidentId: rootIncident.id,

    incidentType: rootIncident.incident_type,

    resourceUid: rootIncident.resource_uid,

    resourceKind: rootIncident.resource_kind,

    resourceName: rootIncident.resource_name,

    namespace: rootIncident.namespace,

    severity: rootIncident.severity,

    status: rootIncident.status,

    workloadUid: rootIncident.workload_uid,

    workloadKind: rootIncident.workload_kind,

    workloadName: rootIncident.workload_name,

    depth: 0,
  });

  visitedIncidents.add(rootIncident.id);

  if (rootIncident.resource_uid) {
    visitedResources.add(rootIncident.resource_uid);

    resourceQueue.push({
      uid: rootIncident.resource_uid,

      clusterId: rootIncident.cluster_id,

      depth: 0,
    });
  }

  /*
   * -----------------------------------------
   * Process topology breadth-first
   * -----------------------------------------
   */
  while (resourceQueue.length > 0) {
    const current = resourceQueue.shift();

    if (current.depth >= maxDepth) {
      continue;
    }

    const children = await findTopologyChildren({
      clusterId: current.clusterId,

      parentUid: current.uid,

      relationshipType: "OWNS",
    });

    /*
     * Examine every topology child.
     */
    for (const child of children) {
      if (!child.uid) {
        continue;
      }

      /*
       * Don't walk the same resource twice.
       */
      if (visitedResources.has(child.uid)) {
        continue;
      }

      visitedResources.add(child.uid);

      /*
       * Check whether this specific
       * topology resource has an active
       * incident.
       */
      const childIncident = await findActiveIncidentForResource({
        clusterId: current.clusterId,

        resourceUid: child.uid,
      });

      if (childIncident && !visitedIncidents.has(childIncident.id)) {
        visitedIncidents.add(childIncident.id);

        chain.push({
          type: "INCIDENT",

          incidentId: childIncident.id,

          incidentType: childIncident.incident_type,

          resourceUid: childIncident.resource_uid,

          resourceKind: childIncident.resource_kind,

          resourceName: childIncident.resource_name,

          namespace: childIncident.namespace,

          severity: childIncident.severity,

          status: childIncident.status,

          workloadUid: childIncident.workload_uid,

          workloadKind: childIncident.workload_kind,

          workloadName: childIncident.workload_name,

          relationshipType: child.relationshipType,

          relationshipConfidence: child.confidence,

          depth: current.depth + 1,
        });

        /*
         * Load child diagnosis.
         */
        const diagnosis = await loadDiagnosis(childIncident.id);

        if (diagnosis) {
          chain.push({
            type: "DIAGNOSIS",

            diagnosisId: diagnosis.id,

            incidentId: diagnosis.incident_id,

            cause: diagnosis.primary_cause,

            confidence: Number(diagnosis.confidence),

            summary: diagnosis.summary,

            depth: current.depth + 1,
          });
        }
      }

      /*
       * IMPORTANT:
       *
       * Continue walking even if this resource
       * has no incident.
       *
       * This is what allows:
       *
       * Deployment
       *   ↓
       * ReplicaSet
       *   ↓
       * Pod
       *
       * when only the Pod has the incident.
       */
      resourceQueue.push({
        uid: child.uid,

        clusterId: current.clusterId,

        depth: current.depth + 1,
      });
    }
  }

  return chain;
}
