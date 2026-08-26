export function errorHandler(error, req, res, next) {
  console.error(`[Error] ${req.method} ${req.originalUrl}`, error);

  if (error.name === "ZodError") {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: error.issues,
      },
    });
  }

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,

    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",

      message: statusCode === 500 ? "Internal server error" : error.message,
    },
  });
}
