import { db } from "../database/postgres.js";

export async function requireWorkspace(req, res, next) {
  try {
    const workspaceId = req.params.workspaceId || req.headers["x-workspace-id"];

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "WORKSPACE_REQUIRED",
          message: "Workspace ID is required",
        },
      });
    }

    const result = await db.query(
      `
      SELECT
        w.id,
        w.name,
        wm.role
      FROM workspaces w
      INNER JOIN workspace_members wm
        ON wm.workspace_id = w.id
      WHERE
        w.id = $1
        AND wm.user_id = $2
      `,
      [workspaceId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: "WORKSPACE_ACCESS_DENIED",
          message: "You do not have access to this workspace",
        },
      });
    }

    req.workspace = result.rows[0];

    next();
  } catch (error) {
    next(error);
  }
}
