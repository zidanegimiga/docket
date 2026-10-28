import { performance } from "node:perf_hooks";

import type { Request, RequestHandler } from "express";

import type { Monitor } from "../../core/monitoring/monitor.interface.js";

function routeLabel(req: Request): string {
  const routePath: unknown = req.route?.path;
  if (typeof routePath !== "string") return "unmatched";
  if (routePath === "/") return req.baseUrl || "/";
  return `${req.baseUrl}${routePath}`;
}

export function requestLogger(monitor: Monitor): RequestHandler {
  return (req, res, next) => {
    const startedAt = performance.now();
    req.log.debug("Request received", { forwardedFor: req.get("x-forwarded-for") ?? null });

    res.on("close", () => {
      const durationMs = Math.round(performance.now() - startedAt);
      const route = routeLabel(req);
      const context = {
        method: req.method,
        path: req.originalUrl,
        route,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
      };

      if (!res.writableFinished) {
        req.log.warn("Request aborted by client", context);
      } else if (res.statusCode >= 500) {
        req.log.error("Request failed", context);
      } else if (res.statusCode >= 400) {
        req.log.warn("Request rejected", context);
      } else {
        req.log.info("Request completed", context);
      }

      monitor.recordMetric("http.request.duration_ms", durationMs, {
        method: req.method,
        route,
        status: String(res.statusCode),
      });
    });

    next();
  };
}
