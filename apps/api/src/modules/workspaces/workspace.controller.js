import {
  createWorkspaceSchema
} from "./workspace.schema.js";

import {
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceById
} from "./workspace.service.js";


export async function listWorkspaces(
  req,
  res,
  next
) {
  try {

    const workspaces =
      await getUserWorkspaces(
        req.user.id
      );

    res.json({
      success: true,
      data: {
        workspaces
      }
    });

  } catch (error) {

    next(error);

  }
}


export async function getWorkspace(
  req,
  res,
  next
) {
  try {

    const workspace =
      await getWorkspaceById(
        req.params.workspaceId,
        req.user.id
      );

    res.json({
      success: true,
      data: {
        workspace
      }
    });

  } catch (error) {

    next(error);

  }
}


export async function create(
  req,
  res,
  next
) {
  try {

    const data =
      createWorkspaceSchema.parse(
        req.body
      );

    const workspace =
      await createWorkspace({
        userId: req.user.id,
        name: data.name
      });

    res.status(201).json({
      success: true,
      data: {
        workspace
      }
    });

  } catch (error) {

    next(error);

  }
}