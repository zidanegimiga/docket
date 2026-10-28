import type { RequestHandler } from "express";

import { ForbiddenError } from "../errors/forbidden.error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface OriginCheckOptions {
  /** Origins whose pages may send state-changing requests, such as the web app. */
  allowedOrigins: readonly string[];
}

/**
 * Rejects state-changing requests a browser sent on behalf of another site (CSRF).
 *
 * Browsers label requests with Sec-Fetch-Site and Origin, and pages cannot forge either.
 * A request with neither comes from a non-browser client, which is only let through without
 * cookies, since cookies are the credential a forged request would ride on.
 */
export function originCheck({ allowedOrigins }: OriginCheckOptions): RequestHandler {
  const allowed = new Set(allowedOrigins);

  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const fetchSite = req.get("Sec-Fetch-Site");
    const origin = req.get("Origin");

    // "same-origin" covers the web app calling through its own /api proxy.
    if (fetchSite === "same-origin" || fetchSite === "none") return next();
    if (origin !== undefined && allowed.has(origin)) return next();
    if (fetchSite === undefined && origin === undefined && req.get("Cookie") === undefined) {
      return next();
    }

    next(new ForbiddenError("CROSS_ORIGIN_REQUEST", "Cross-origin requests are not allowed"));
  };
}
