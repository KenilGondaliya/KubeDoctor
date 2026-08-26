import {
  createClusterSchema
} from "./cluster.schema.js";

import {
  createCluster,
  listClusters,
  getCluster,
  deleteCluster,
  testConnection
} from "./cluster.service.js";


export async function create(
  req,
  res,
  next
) {
  try {

    const data =
      createClusterSchema.parse(
        req.body
      );


    const cluster =
      await createCluster({
        workspaceId:
          req.workspace.id,

        name:
          data.name,

        connectionType:
          data.connectionType,

        kubeContext:
          data.kubeContext,

        namespace:
          data.namespace
      });


    res.status(201).json({
      success: true,
      data: {
        cluster
      }
    });

  } catch (error) {

    next(error);

  }
}


export async function list(
  req,
  res,
  next
) {
  try {

    const clusters =
      await listClusters(
        req.workspace.id
      );


    res.json({
      success: true,
      data: {
        clusters
      }
    });

  } catch (error) {

    next(error);

  }
}


export async function get(
  req,
  res,
  next
) {
  try {

    const cluster =
      await getCluster(
        req.workspace.id,
        req.params.clusterId
      );


    res.json({
      success: true,
      data: {
        cluster
      }
    });

  } catch (error) {

    next(error);

  }
}


export async function remove(
  req,
  res,
  next
) {
  try {

    const result =
      await deleteCluster(
        req.workspace.id,
        req.params.clusterId
      );


    res.json({
      success: true,
      data: result
    });

  } catch (error) {

    next(error);

  }
}


export async function test(
  req,
  res,
  next
) {
  try {

    const result =
      await testConnection(
        req.workspace.id,
        req.params.clusterId
      );


    res.json({
      success: true,
      data: result
    });

  } catch (error) {

    next(error);

  }
}