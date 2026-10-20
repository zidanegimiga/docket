import type { ErrorRequestHandler } from "express";

import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import { AppError } from "../errors/app.error.js";

const BODY_PARSER_ERRORS: Record<string, () => AppError> = {
  "entity.parse.failed": () =>
    new AppError(400, "MALFORMED_JSON", "Request body is not valid JSON"),
  "entity.too.large": () => new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large"),
};

function toAppError(error: unknown): AppError | undefined {
  if (error instanceof AppError) {
    return error;
  }

  const type: unknown = (error as { type?: unknown } | null)?.type;
  return typeof type === "string" ? BODY_PARSER_ERRORS[type]?.() : undefined;
}

export function errorHandler(monitor: Monitor): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    let appError = toAppError(error);

    if (!appError) {
      monitor.captureException(error, {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
      });
      appError = new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred");
    }

    const { statusCode, code, message, details } = appError;

    res.status(statusCode).json({
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
        requestId: req.id,
      },
    });
  };
}
