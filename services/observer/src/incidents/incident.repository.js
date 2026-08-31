import { db } from "../config/database.js";

export async function findOpenIncident({
  clusterId,
  resourceUid,
  incidentType,
}) {
  const result = await db.query(
    `
      SELECT *
      FROM incidents
      WHERE
        cluster_id = $1
        AND resource_uid = $2
        AND incident_type = $3
        AND status != 'RESOLVED'
      ORDER BY created_at DESC
      LIMIT 1
      `,
    [clusterId, resourceUid, incidentType],
  );

  return result.rows[0] || null;
}

/**
 * Find an active incident by logical workload.
 *
 * This is the primary lookup for controller-managed
 * resources such as Pods.
 */
export async function findOpenIncidentByWorkload({
  clusterId,
  workloadUid,
  incidentType,
}) {
  const result = await db.query(
    `
      SELECT *
      FROM incidents
      WHERE
        cluster_id = $1
        AND workload_uid = $2
        AND incident_type = $3
        AND status != 'RESOLVED'
      ORDER BY created_at DESC
      LIMIT 1
      `,
    [clusterId, workloadUid, incidentType],
  );

  return result.rows[0] || null;
}

/**
 * Find the most recent resolved incident
 * for the same logical workload.
 */
export async function findResolvedIncidentByWorkload({
  clusterId,
  workloadUid,
  incidentType,
}) {
  const result = await db.query(
    `
      SELECT *
      FROM incidents
      WHERE
        cluster_id = $1
        AND workload_uid = $2
        AND incident_type = $3
        AND status = 'RESOLVED'
      ORDER BY resolved_at DESC NULLS LAST
      LIMIT 1
      `,
    [clusterId, workloadUid, incidentType],
  );

  return result.rows[0] || null;
}

/**
 * Create a new logical incident.
 */
export async function createIncident({ clusterId, incident, workload }) {
  const result = await db.query(
    `
      INSERT INTO incidents (
        cluster_id,
        resource_uid,
        resource_kind,
        resource_name,
        namespace,
        incident_type,
        severity,
        status,
        title,
        description,
        evidence,
        workload_uid,
        workload_kind,
        workload_name,
        first_seen_at,
        last_seen_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        'OPEN',
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING *
      `,
    [
      clusterId,

      incident.resourceUid,

      incident.resourceKind,

      incident.resourceName,

      incident.namespace,

      incident.incidentType,

      incident.severity,

      incident.title,

      incident.description,

      JSON.stringify(incident.evidence || {}),

      workload?.uid || incident.resourceUid,

      workload?.kind || incident.resourceKind,

      workload?.name || incident.resourceName,
    ],
  );

  return result.rows[0];
}

/**
 * Update an active incident.
 */
export async function updateIncident({ incidentId, incident }) {
  const result = await db.query(
    `
      UPDATE incidents
      SET
        resource_uid = $1,
        resource_kind = $2,
        resource_name = $3,
        severity = $4,
        title = $5,
        description = $6,
        evidence = $7,
        last_seen_at = NOW(),
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
      `,
    [
      incident.resourceUid,

      incident.resourceKind,

      incident.resourceName,

      incident.severity,

      incident.title,

      incident.description,

      JSON.stringify(incident.evidence || {}),

      incidentId,
    ],
  );

  return result.rows[0] || null;
}

/**
 * Reopen an existing resolved incident.
 *
 * The logical workload stays the same,
 * while the affected Pod/resource may be new.
 */
export async function reopenIncident({ incidentId, incident }) {
  const result = await db.query(
    `
      UPDATE incidents
      SET
        resource_uid = $1,
        resource_kind = $2,
        resource_name = $3,
        severity = $4,
        status = 'OPEN',
        title = $5,
        description = $6,
        evidence = $7,
        first_seen_at = NOW(),
        last_seen_at = NOW(),
        resolved_at = NULL,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
      `,
    [
      incident.resourceUid,

      incident.resourceKind,

      incident.resourceName,

      incident.severity,

      incident.title,

      incident.description,

      JSON.stringify(incident.evidence || {}),

      incidentId,
    ],
  );

  return result.rows[0] || null;
}

/**
 * Resolve a logical workload incident.
 */
export async function resolveIncidentByWorkload({
  clusterId,
  workloadUid,
  incidentType,
}) {
  const result = await db.query(
    `
      UPDATE incidents
      SET
        status = 'RESOLVED',
        resolved_at = NOW(),
        updated_at = NOW(),
        last_seen_at = NOW()
      WHERE
        cluster_id = $1
        AND workload_uid = $2
        AND incident_type = $3
        AND status != 'RESOLVED'
      RETURNING *
      `,
    [clusterId, workloadUid, incidentType],
  );

  return result.rows[0] || null;
}

/**
 * List currently active incidents.
 */
export async function listOpenIncidents(clusterId) {
  const result = await db.query(
    `
      SELECT *
      FROM incidents
      WHERE
        cluster_id = $1
        AND status != 'RESOLVED'
      ORDER BY
        severity DESC,
        last_seen_at DESC
      `,
    [clusterId],
  );

  return result.rows;
}
