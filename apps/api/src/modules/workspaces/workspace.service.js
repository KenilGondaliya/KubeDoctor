import { db } from "../../database/postgres.js";


export async function getUserWorkspaces(userId) {
  const result = await db.query(
    `
    SELECT
      w.id,
      w.name,
      wm.role,
      wm.created_at AS joined_at
    FROM workspaces w
    INNER JOIN workspace_members wm
      ON wm.workspace_id = w.id
    WHERE wm.user_id = $1
    ORDER BY w.created_at DESC
    `,
    [userId]
  );

  return result.rows;
}


export async function getWorkspaceById(
  workspaceId,
  userId
) {
  const result = await db.query(
    `
    SELECT
      w.id,
      w.name,
      wm.role,
      wm.created_at AS joined_at
    FROM workspaces w
    INNER JOIN workspace_members wm
      ON wm.workspace_id = w.id
    WHERE
      w.id = $1
      AND wm.user_id = $2
    `,
    [
      workspaceId,
      userId
    ]
  );

  if (result.rows.length === 0) {
    const error = new Error(
      "Workspace not found or access denied"
    );

    error.statusCode = 404;

    throw error;
  }

  return result.rows[0];
}


export async function createWorkspace({
  userId,
  name
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const workspaceResult =
      await client.query(
        `
        INSERT INTO workspaces (name)
        VALUES ($1)
        RETURNING id, name, created_at
        `,
        [name]
      );

    const workspace =
      workspaceResult.rows[0];

    await client.query(
      `
      INSERT INTO workspace_members (
        workspace_id,
        user_id,
        role
      )
      VALUES ($1, $2, $3)
      `,
      [
        workspace.id,
        userId,
        "Owner"
      ]
    );

    await client.query("COMMIT");

    return {
      ...workspace,
      role: "Owner"
    };

  } catch (error) {

    await client.query("ROLLBACK");

    throw error;

  } finally {

    client.release();

  }
}