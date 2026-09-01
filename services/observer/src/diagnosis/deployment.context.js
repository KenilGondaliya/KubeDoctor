import { db } from "../config/database.js";

export async function findChildIncidents({ clusterId, workloadUid }) {
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
    [clusterId, workloadUid],
  );

  return result.rows;
}
