import { verifyToken } from "../modules/auth/auth.utils.js";

export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "Authorization header is required",
        },
      });
    }

    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_AUTH_HEADER",
          message: "Use Authorization: Bearer <token>",
        },
      });
    }

    const payload = verifyToken(token);

    if (payload.type !== "access") {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN_TYPE",
          message: "Access token required",
        },
      });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
      },
    });
  }
}
