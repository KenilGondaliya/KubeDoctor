import { db } from "../config/database.js";

import { buildTopology } from "../../../../packages/topology-engine/src/topology-engine.js";

import { replaceRelationships } from "./topology.repository.js";

export async function rebuildTopology(clusterId) {
  const result = await db.query(
    `
      SELECT
        uid,
        api_version,
        kind,
        name,
        namespace,
        labels,
        annotations,
        resource
      FROM resource_snapshots
      WHERE cluster_id = $1
      `,
    [clusterId],
  );

  const topology = buildTopology(result.rows);

  await replaceRelationships(clusterId, topology.relationships);

  console.log(
    `[Topology] ${clusterId}: ` +
      `${topology.resources.length} resources, ` +
      `${topology.relationships.length} relationships`,
  );

  return topology;
}
