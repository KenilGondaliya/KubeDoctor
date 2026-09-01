import { db } from "./config/database.js";
import { runDiagnosis } from "./diagnosis/diagnosis.service.js";

const INCIDENT_ID =
  "5c750df4-cada-4782-90f7-2d8334ba0623";

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
    throw new Error("Child incident not found");
  }

  const incident = result.rows[0];

  console.log(
    "[TEST] Running diagnosis for:",
    incident.id,
  );

  const diagnosis =
    await runDiagnosis(incident);

  console.log(
    JSON.stringify(
      diagnosis,
      null,
      2,
    ),
  );
} catch (error) {
  console.error("[TEST] Failed:", error);
} finally {
  await db.end();
}