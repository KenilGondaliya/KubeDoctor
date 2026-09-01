import crypto from "node:crypto";

import { db } from "./config/database.js";

import { processResourceEvent } from "./incidents/incident.service.js";

const CLUSTER_ID = "be297b5c-b9c3-46b9-8770-780e6f1f2459";

const DEPLOYMENT_NAME = "kubedoctor-liveness-test";

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
      AND kind = 'Deployment'
      AND name = $2
    LIMIT 1
    `,
    [CLUSTER_ID, DEPLOYMENT_NAME],
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Deployment not found in resource_snapshots: ${DEPLOYMENT_NAME}`,
    );
  }

  const snapshot = result.rows[0];

  console.log("[TEST] Found Deployment snapshot:", snapshot.name, snapshot.uid);

  const event = {
    eventId: crypto.randomUUID(),

    eventType: "kubernetes.resource",

    operation: "RECONCILE",

    clusterId: CLUSTER_ID,

    timestamp: new Date().toISOString(),

    resource: snapshot.resource,
  };

  console.log("[TEST] Processing real Deployment snapshot...");

  const resultIncident = await processResourceEvent(event);

  console.log(
    "[TEST] Incident result:",
    JSON.stringify(resultIncident, null, 2),
  );
} catch (error) {
  console.error("[TEST] Failed:", error);
} finally {
  await db.end();
}
