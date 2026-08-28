import { db } from "./config/database.js";

import { env } from "./config/env.js";

import { collectIncidentEvidence } from "./evidence/evidence.service.js";

try {
  const incidentResult = await db.query(
    `
      SELECT *
      FROM incidents
      WHERE
        cluster_id = $1
        AND incident_type = 'POD_CRASH_LOOP'
        AND status != 'RESOLVED'
      ORDER BY created_at DESC
      LIMIT 1
      `,
    [env.clusterId],
  );

  if (incidentResult.rows.length === 0) {
    throw new Error("No open POD_CRASH_LOOP incident found");
  }

  const incident = incidentResult.rows[0];

  const snapshotResult = await db.query(
    `
      SELECT
        uid,
        kind,
        name,
        namespace,
        labels,
        resource_version,
        resource
      FROM resource_snapshots
      WHERE
        cluster_id = $1
        AND uid = $2
      `,
    [env.clusterId, incident.resource_uid],
  );

  if (snapshotResult.rows.length === 0) {
    throw new Error("No snapshot found for incident resource");
  }

  const snapshot = snapshotResult.rows[0];

  const evidence = await collectIncidentEvidence({
    incident,

    snapshot,
  });

  console.log(`[TEST] Saved ${evidence.length} evidence items`);
} catch (error) {
  console.error("[TEST] Evidence collection failed:", error);
} finally {
  await db.end();
}
