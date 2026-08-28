import { db } from "../config/database.js";

export async function replaceRelationships(clusterId, relationships) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM resource_relationships
      WHERE cluster_id = $1
      `,
      [clusterId],
    );

    for (const relationship of relationships) {
      await client.query(
        `
        INSERT INTO resource_relationships (
          cluster_id,
          source_uid,
          target_uid,
          relationship_type,
          confidence,
          metadata,
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
          NOW(),
          NOW()
        )
        ON CONFLICT (
          cluster_id,
          source_uid,
          target_uid,
          relationship_type
        )
        DO UPDATE SET
          confidence =
            EXCLUDED.confidence,

          metadata =
            EXCLUDED.metadata,

          updated_at =
            NOW()
        `,
        [
          clusterId,
          relationship.sourceUid,
          relationship.targetUid,
          relationship.type,
          relationship.confidence,
          JSON.stringify(relationship.metadata || {}),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}
