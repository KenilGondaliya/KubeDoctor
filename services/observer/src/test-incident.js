import crypto from "node:crypto";
import { db } from "./config/database.js";
import { env } from "./config/env.js";
import { processResourceEvent } from "./incidents/incident.service.js";

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
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [env.clusterId],
  );

  if (result.rows.length === 0) {
    throw new Error("No Pod snapshot found for this cluster");
  }

  const snapshot = result.rows[0];

  const resource = snapshot.resource;

  const event = {
    eventId: crypto.randomUUID(),

    eventType: "kubernetes.resource",

    operation: "RECONCILE",

    clusterId: env.clusterId,

    timestamp: new Date().toISOString(),

    resource,
  };

  console.log("[TEST] Testing incident detection for:", resource.name);

  const resultIncident = await processResourceEvent(event);

  console.log("[TEST] Incident processing result:", resultIncident);
} catch (error) {
  console.error("[TEST] Incident detection failed:", error);
} finally {
  await db.end();
}
