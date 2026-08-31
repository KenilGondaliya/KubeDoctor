import { db } from "./config/database.js";

import {
  detectIncident,
} from "./incidents/incident.detector.js";


const UID =
  "607b3a6c-9d20-4f25-9f7a-05d2215b3246";


try {
  const result =
    await db.query(
      `
      SELECT
        uid,
        resource
      FROM resource_snapshots
      WHERE uid = $1
      LIMIT 1
      `,
      [UID],
    );


  if (
    result.rows.length === 0
  ) {
    throw new Error(
      "Snapshot not found",
    );
  }


  const resource =
    result.rows[0].resource;


  console.log(
    "[TEST] Real resource:",
    JSON.stringify(
      resource,
      null,
      2,
    ),
  );


  console.log(
    "[TEST] Real container statuses:",
    JSON.stringify(
      resource?.status?.containerStatuses,
      null,
      2,
    ),
  );


  const event = {
    clusterId:
      "be297b5c-b9c3-46b9-8770-780e6f1f2459",

    resource,
  };


  const incident =
    detectIncident(event);


  console.log(
    "[TEST] Detection result:",
    JSON.stringify(
      incident,
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