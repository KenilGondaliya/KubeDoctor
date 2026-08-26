import { db } from "../../database/postgres.js";

import {
  testClusterConnection
} from "./kubernetes.service.js";


export async function createCluster({
  workspaceId,
  name,
  connectionType,
  kubeContext,
  namespace
}) {

  const result = await db.query(
    `
    INSERT INTO clusters (
      workspace_id,
      name,
      connection_type,
      kube_context,
      namespace,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      workspace_id,
      name,
      connection_type,
      kube_context,
      namespace,
      status,
      created_at
    `,
    [
      workspaceId,
      name,
      connectionType,
      kubeContext,
      namespace || null,
      "UNKNOWN"
    ]
  );

  return result.rows[0];
}


export async function listClusters(
  workspaceId
) {
  const result = await db.query(
    `
    SELECT
      id,
      workspace_id,
      name,
      connection_type,
      kube_context,
      namespace,
      status,
      last_connected_at,
      last_error,
      created_at,
      updated_at
    FROM clusters
    WHERE workspace_id = $1
    ORDER BY created_at DESC
    `,
    [workspaceId]
  );

  return result.rows;
}


export async function getCluster(
  workspaceId,
  clusterId
) {
  const result = await db.query(
    `
    SELECT
      id,
      workspace_id,
      name,
      connection_type,
      kube_context,
      namespace,
      status,
      last_connected_at,
      last_error,
      created_at,
      updated_at
    FROM clusters
    WHERE
      id = $1
      AND workspace_id = $2
    `,
    [
      clusterId,
      workspaceId
    ]
  );


  if (result.rows.length === 0) {

    const error = new Error(
      "Cluster not found"
    );

    error.statusCode = 404;

    throw error;
  }


  return result.rows[0];
}


export async function deleteCluster(
  workspaceId,
  clusterId
) {
  const result = await db.query(
    `
    DELETE FROM clusters
    WHERE
      id = $1
      AND workspace_id = $2
    RETURNING id
    `,
    [
      clusterId,
      workspaceId
    ]
  );


  if (result.rows.length === 0) {

    const error = new Error(
      "Cluster not found"
    );

    error.statusCode = 404;

    throw error;
  }


  return result.rows[0];
}


export async function testConnection(
  workspaceId,
  clusterId
) {
  const cluster =
    await getCluster(
      workspaceId,
      clusterId
    );


  try {

    const result =
      await testClusterConnection(
        cluster.kube_context
      );


    await db.query(
      `
      UPDATE clusters
      SET
        status = $1,
        last_connected_at = NOW(),
        last_error = NULL,
        updated_at = NOW()
      WHERE id = $2
      `,
      [
        "CONNECTED",
        cluster.id
      ]
    );


    return {
      cluster,
      connection: result
    };

  } catch (error) {

    await db.query(
      `
      UPDATE clusters
      SET
        status = $1,
        last_error = $2,
        updated_at = NOW()
      WHERE id = $3
      `,
      [
        "ERROR",
        error.message,
        cluster.id
      ]
    );


    throw error;
  }
}