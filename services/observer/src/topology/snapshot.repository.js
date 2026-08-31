import { db } from "../config/database.js";

export async function upsertSnapshot(event) {
  const resource = event.resource;

  await db.query(
    `
    INSERT INTO resource_snapshots (
      cluster_id,
      uid,
      api_version,
      kind,
      name,
      namespace,
      resource_version,
      labels,
      annotations,
      resource,
      observed_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      NOW(),
      NOW()
    )
    ON CONFLICT (
      cluster_id,
      uid
    )
    DO UPDATE SET
      api_version =
        EXCLUDED.api_version,

      kind =
        EXCLUDED.kind,

      name =
        EXCLUDED.name,

      namespace =
        EXCLUDED.namespace,

      resource_version =
        EXCLUDED.resource_version,

      labels =
        EXCLUDED.labels,

      annotations =
        EXCLUDED.annotations,

      resource =
        EXCLUDED.resource,

      observed_at =
        NOW(),

      updated_at =
        NOW()
    `,
    [
      event.clusterId,
      resource.uid,
      resource.apiVersion,
      resource.kind,
      resource.name,
      resource.namespace,
      resource.resourceVersion,
      JSON.stringify(resource.labels),
      JSON.stringify(resource.annotations),
      JSON.stringify(resource),
    ],
  );
}

export async function deleteSnapshot({ clusterId, uid }) {
  await db.query(
    `
    DELETE FROM resource_snapshots
    WHERE
      cluster_id = $1
      AND uid = $2
    `,
    [clusterId, uid],
  );

  console.log(`[Snapshot] Deleted ${uid}`);
}
