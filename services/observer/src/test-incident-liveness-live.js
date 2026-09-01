import crypto from "node:crypto";

import { db } from "./config/database.js";

import { processResourceEvent } from "./incidents/incident.service.js";

const CLUSTER_ID = "be297b5c-b9c3-46b9-8770-780e6f1f2459";

const POD_NAME = "kubedoctor-liveness-test-7486cf75cb-hv92j";

async function loadPodSnapshot() {
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
      AND name = $2
    LIMIT 1
    `,
    [CLUSTER_ID, POD_NAME],
  );

  return result.rows[0] || null;
}

async function loadRelatedEvents(podUid) {
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
      AND kind = 'Event'
    ORDER BY updated_at DESC
    LIMIT 500
    `,
    [CLUSTER_ID],
  );

  return result.rows.filter((row) => {
    const rawEvent = row.resource?.raw || row.resource || {};

    const involvedObject = rawEvent.involvedObject || {};

    return involvedObject.uid === podUid;
  });
}

try {
  const snapshot = await loadPodSnapshot();

  if (!snapshot) {
    throw new Error(
      `Liveness test Pod not found in resource_snapshots: ${POD_NAME}`,
    );
  }

  console.log("[TEST] Found liveness snapshot:", snapshot.name, snapshot.uid);

  const events = await loadRelatedEvents(snapshot.uid);

  console.log(`[TEST] Related Kubernetes events: ${events.length}`);

  for (const event of events) {
    const rawEvent = event.resource?.raw || event.resource || {};

    console.log(
      `[TEST] Event: ${rawEvent.reason || "UNKNOWN"} - ${
        rawEvent.message || "No message"
      }`,
    );
  }

  const event = {
    eventId: crypto.randomUUID(),

    eventType: "kubernetes.resource",

    operation: "RECONCILE",

    clusterId: CLUSTER_ID,

    timestamp: new Date().toISOString(),

    resource: snapshot.resource,

    kubernetesEvents: events,
  };

  console.log("[TEST] Processing real snapshot + Kubernetes events...");

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
