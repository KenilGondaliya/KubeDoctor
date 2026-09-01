import { db } from "../config/database.js";

export async function replaceRelationships(clusterId, relationships) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    /*
     * Rebuild current topology for this cluster.
     */
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

/*
 * -----------------------------------------
 * Find outgoing relationships
 * -----------------------------------------
 *
 * Example:
 *
 * Deployment
 *    ↓ OWNS
 * ReplicaSet
 */
export async function findOutgoingRelationships({
  clusterId,
  sourceUid,
  relationshipType = null,
}) {
  const params = [clusterId, sourceUid];

  let typeCondition = "";

  if (relationshipType) {
    params.push(relationshipType);

    typeCondition = "AND relationship_type = $3";
  }

  const result = await db.query(
    `
      SELECT
        id,
        cluster_id,
        source_uid,
        target_uid,
        relationship_type,
        confidence,
        metadata,
        observed_at,
        updated_at
      FROM resource_relationships
      WHERE
        cluster_id = $1
        AND source_uid = $2
        ${typeCondition}
      ORDER BY
        confidence DESC,
        updated_at DESC
      `,
    params,
  );

  return result.rows;
}

/*
 * -----------------------------------------
 * Find incoming relationships
 * -----------------------------------------
 *
 * Example:
 *
 * Pod
 *   ↑ OWNS
 * ReplicaSet
 */
export async function findIncomingRelationships({
  clusterId,
  targetUid,
  relationshipType = null,
}) {
  const params = [clusterId, targetUid];

  let typeCondition = "";

  if (relationshipType) {
    params.push(relationshipType);

    typeCondition = "AND relationship_type = $3";
  }

  const result = await db.query(
    `
      SELECT
        id,
        cluster_id,
        source_uid,
        target_uid,
        relationship_type,
        confidence,
        metadata,
        observed_at,
        updated_at
      FROM resource_relationships
      WHERE
        cluster_id = $1
        AND target_uid = $2
        ${typeCondition}
      ORDER BY
        confidence DESC,
        updated_at DESC
      `,
    params,
  );

  return result.rows;
}

/*
 * -----------------------------------------
 * Find direct related resources
 * -----------------------------------------
 */
export async function findRelatedResources({
  clusterId,
  uid,
  relationshipType = null,
}) {
  const outgoing = await findOutgoingRelationships({
    clusterId,
    sourceUid: uid,
    relationshipType,
  });

  const incoming = await findIncomingRelationships({
    clusterId,
    targetUid: uid,
    relationshipType,
  });

  return {
    outgoing,
    incoming,
  };
}

/*
 * -----------------------------------------
 * Find topology children
 * -----------------------------------------
 *
 * This is the function the causal resolver
 * will primarily use.
 */
export async function findTopologyChildren({
  clusterId,
  parentUid,
  relationshipType = "OWNS",
}) {
  const relationships = await findOutgoingRelationships({
    clusterId,

    sourceUid: parentUid,

    relationshipType,
  });

  return relationships.map((relationship) => ({
    uid: relationship.target_uid,

    relationshipType: relationship.relationship_type,

    confidence: Number(relationship.confidence),

    metadata: relationship.metadata || {},
  }));
}

/*
 * -----------------------------------------
 * Find topology parents
 * -----------------------------------------
 */
export async function findTopologyParents({
  clusterId,
  childUid,
  relationshipType = "OWNS",
}) {
  const relationships = await findIncomingRelationships({
    clusterId,

    targetUid: childUid,

    relationshipType,
  });

  return relationships.map((relationship) => ({
    uid: relationship.source_uid,

    relationshipType: relationship.relationship_type,

    confidence: Number(relationship.confidence),

    metadata: relationship.metadata || {},
  }));
}
