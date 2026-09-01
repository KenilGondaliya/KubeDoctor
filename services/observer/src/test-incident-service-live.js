import crypto from "node:crypto";

import { db } from "./config/database.js";

import {
  processResourceEvent,
} from "./incidents/incident.service.js";


const CLUSTER_ID =
  "be297b5c-b9c3-46b9-8770-780e6f1f2459";

const SERVICE_NAME =
  "kubedoctor-no-endpoints-test";


async function loadService() {
  const result =
    await db.query(
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
        AND kind = 'Service'
        AND name = $2
      LIMIT 1
      `,
      [
        CLUSTER_ID,
        SERVICE_NAME,
      ],
    );

  return result.rows[0] || null;
}


async function loadEndpointSlices() {
  const result =
    await db.query(
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
        AND kind = 'EndpointSlice'
      `,
      [CLUSTER_ID],
    );

  return result.rows.filter(
    (row) => {
      const raw =
        row.resource?.raw ||
        row.resource ||
        {};

      const labels =
        raw.metadata?.labels ||
        {};

      return (
        labels[
          "kubernetes.io/service-name"
        ] === SERVICE_NAME
      );
    },
  );
}


try {
  const service =
    await loadService();


  if (!service) {
    throw new Error(
      `Service not found in resource_snapshots: ${SERVICE_NAME}`,
    );
  }


  const endpointSlices =
    await loadEndpointSlices();


  console.log(
    "[TEST] Found Service:",
    service.name,
    service.uid,
  );


  console.log(
    `[TEST] Found EndpointSlices: ${endpointSlices.length}`,
  );


  for (
    const slice of endpointSlices
  ) {
    const raw =
      slice.resource?.raw ||
      slice.resource ||
      {};

    console.log(
      `[TEST] EndpointSlice: ${slice.name}`,
    );

    for (
      const endpoint
      of raw.endpoints || []
    ) {
      console.log(
        "[TEST] Endpoint:",
        JSON.stringify(
          {
            addresses:
              endpoint.addresses,

            ready:
              endpoint.conditions
                ?.ready ?? false,

            serving:
              endpoint.conditions
                ?.serving ?? false,

            targetRef:
              endpoint.targetRef ||
              null,
          },
          null,
          2,
        ),
      );
    }
  }


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
      service.resource,

    endpointSlices,
  };


  console.log(
    "[TEST] Processing Service + EndpointSlices...",
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