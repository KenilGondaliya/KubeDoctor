import { db } from "./config/database.js";

import { processResourceEvent } from "./incidents/incident.service.js";

import crypto from "node:crypto";


const CLUSTER_ID =
  "be297b5c-b9c3-46b9-8770-780e6f1f2459";


try {
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
      AND kind = 'Pod'
      AND name LIKE 'kubedoctor-oom-test%'
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [CLUSTER_ID],
  );


  if (result.rows.length === 0) {
    throw new Error(
      "OOM test Pod not found in resource_snapshots",
    );
  }


  const snapshot =
    result.rows[0];


  console.log(
    "[TEST] Found OOM snapshot:",
    snapshot.name,
    snapshot.uid,
  );


  const event = {
    eventId:
      crypto.randomUUID(),

    eventType:
      "kubernetes.resource",

    operation:
      "RECONCILE",

    clusterId:
      CLUSTER_ID,

    timestamp:
      new Date().toISOString(),

    resource:
      snapshot.resource,
  };


  console.log(
    "[TEST] Processing real snapshot...",
  );


  const resultIncident =
    await processResourceEvent(
      event,
    );


  console.log(
    "[TEST] Incident result:",
    JSON.stringify(
      resultIncident,
      null,
      2,
    ),
  );

} catch (error) {

  console.error(
    "[TEST] Failed:",
    error,
  );

} finally {

  await db.end();
}