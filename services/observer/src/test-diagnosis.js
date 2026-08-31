import { db } from "./config/database.js";

import { env } from "./config/env.js";

import { runDiagnosis } from "./diagnosis/diagnosis.service.js";

try {
  const result = await db.query(
    `
      SELECT *
      FROM incidents
      WHERE
        cluster_id = $1
        AND status != 'RESOLVED'
      ORDER BY created_at DESC
      LIMIT 1
      `,
    [env.clusterId],
  );

  if (result.rows.length === 0) {
    throw new Error("No open incident found");
  }

  const incident = result.rows[0];

  console.log(`[TEST] Running diagnosis for ${incident.id}`);

  const diagnosis = await runDiagnosis(incident);

  console.log("[TEST] Diagnosis:", JSON.stringify(diagnosis, null, 2));
} catch (error) {
  console.error("[TEST] Diagnosis failed:", error);
} finally {
  await db.end();
}
