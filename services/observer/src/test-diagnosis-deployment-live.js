import { db } from "./config/database.js";

import { runDiagnosis } from "./diagnosis/diagnosis.service.js";

const INCIDENT_ID = "d3309cf9-fd72-4147-81d9-783c96ff9a17";

try {
  const result = await db.query(
    `
      SELECT *
      FROM incidents
      WHERE id = $1
      LIMIT 1
      `,
    [INCIDENT_ID],
  );

  if (result.rows.length === 0) {
    throw new Error("Deployment incident not found");
  }

  const incident = result.rows[0];

  console.log("[TEST] Running Deployment diagnosis for:", incident.id);

  const diagnosis = await runDiagnosis(incident);

  console.log(
    "[TEST] Deployment diagnosis:",
    JSON.stringify(diagnosis, null, 2),
  );
} catch (error) {
  console.error("[TEST] Failed:", error);
} finally {
  await db.end();
}
