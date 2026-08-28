import { db } from "../config/database.js";

export async function findOpenIncident({
  clusterId,
  resourceUid,
  incidentType,
}) {
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
      title,
      description,
      evidence,
      first_seen_at,
      last_seen_at,
      resolved_at,
      created_at,
      updated_at
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

export async function createIncident({ clusterId, incident }) {
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
      JSON.stringify(incident.evidence),
    ],
  );

  return result.rows[0];
}

export async function updateIncident({ incidentId, incident }) {
  const result = await db.query(
    `
    UPDATE incidents
    SET
      severity = $1,
      title = $2,
      description = $3,
      evidence = $4,
      last_seen_at = NOW(),
      updated_at = NOW()
    WHERE id = $5
    RETURNING *
    `,
    [
      incident.severity,
      incident.title,
      incident.description,
      JSON.stringify(incident.evidence),
      incidentId,
    ],
  );

  return result.rows[0];
}

export async function resolveIncident(incidentId) {
  const result = await db.query(
    `
    UPDATE incidents
    SET
      status = 'RESOLVED',
      resolved_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [incidentId],
  );

  return result.rows[0];
}

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
