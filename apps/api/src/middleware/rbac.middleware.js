const ROLE_LEVELS = {
  Viewer: 10,
  Engineer: 20,
  Admin: 30,
  Owner: 40
};


export function requireRole(
  ...allowedRoles
) {
  return (req, res, next) => {

    if (!req.workspace) {

      return res.status(500).json({
        success: false,
        error: {
          code: "WORKSPACE_CONTEXT_MISSING",
          message:
            "Workspace context has not been initialized"
        }
      });

    }


    const currentRole =
      req.workspace.role;


    if (
      allowedRoles.includes(currentRole)
    ) {
      return next();
    }


    return res.status(403).json({
      success: false,
      error: {
        code: "INSUFFICIENT_PERMISSIONS",
        message:
          `Role '${currentRole}' is not allowed`
      }
    });
  };
}


export function requireMinimumRole(
  minimumRole
) {
  return (req, res, next) => {

    if (!req.workspace) {

      return res.status(500).json({
        success: false,
        error: {
          code: "WORKSPACE_CONTEXT_MISSING",
          message:
            "Workspace context has not been initialized"
        }
      });

    }


    const currentLevel =
      ROLE_LEVELS[
        req.workspace.role
      ] || 0;


    const requiredLevel =
      ROLE_LEVELS[
        minimumRole
      ] || 999;


    if (
      currentLevel >= requiredLevel
    ) {
      return next();
    }


    return res.status(403).json({
      success: false,
      error: {
        code: "INSUFFICIENT_PERMISSIONS",
        message:
          `Minimum role '${minimumRole}' required`
      }
    });
  };
}