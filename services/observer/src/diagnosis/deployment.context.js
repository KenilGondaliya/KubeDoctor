import { db } from "../config/database.js";

export async function findChildIncidents({
  clusterId,
  workloadUid,
  excludeIncidentId = null,
}) {
  const result = await db.query(
    `
    SELECT
      id,
      resource_uid,
      resource_kind,
      resource_name,
      incident_type,
      severity,
      status,
      title,
      description,
      first_seen_at,
      last_seen_at
    FROM incidents
    WHERE
      cluster_id = $1
      AND workload_uid = $2
      AND (
        $3::uuid IS NULL
        OR id <> $3
      )
    ORDER BY
      CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END,
      last_seen_at DESC
    `,
    [clusterId, workloadUid, excludeIncidentId],
  );

  return result.rows;
}

export async function findDiagnosisByIncidentId(incidentId) {
  const result = await db.query(
    `
    SELECT
      id,
      incident_id,
      status,
      primary_cause,
      confidence,
      summary,
      reasoning,
      created_at,
      updated_at
    FROM diagnoses
    WHERE incident_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [incidentId],
  );

  return result.rows[0] || null;
}
