import type { Request, RequestHandler, Response } from "express";

import type { Principal, PrincipalResolver } from "../../core/identity/principal.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";

export interface AuthenticateOptions {
  resolver: PrincipalResolver;
  /** The cookie the web app's access token travels in. */
  accessCookieName: string;
}

const BEARER = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/;

/**
 * Requires a valid access token and attaches the caller as req.principal.
 *
 * Browsers send the token in a cookie; other services send it as a bearer token. A request
 * with an Authorization header is judged by that header alone, so a bad bearer token is never
 * rescued by a cookie.
 */
export function authenticate({ resolver, accessCookieName }: AuthenticateOptions): RequestHandler {
  return async (req, res, next) => {
    const token = accessTokenFrom(req, accessCookieName);
    if (token === undefined) {
      res.set("WWW-Authenticate", "Bearer");
      throw new UnauthorizedError("AUTHENTICATION_REQUIRED", "Sign in to continue");
    }

    const result = await resolver.resolve(token);
    if (!result.valid) {
      rejectToken(res, result.reason);
    }

    req.principal = result.principal;
    next();
  };
}

/** The caller of a route behind authenticate(). */
export function principalOf(req: Request): Principal {
  if (!req.principal) {
    throw new Error("principalOf() used on a route without authenticate()");
  }
  return req.principal;
}

function accessTokenFrom(req: Request, cookieName: string): string | undefined {
  const header = req.get("Authorization");
  if (header !== undefined) {
    // An unusable header still counts as presented, so it fails instead of falling back.
    return BEARER.exec(header)?.[1] ?? "";
  }

  const cookie: unknown = req.cookies?.[cookieName];
  return typeof cookie === "string" && cookie.length > 0 ? cookie : undefined;
}

function rejectToken(res: Response, reason: "expired" | "invalid"): never {
  if (reason === "expired") {
    res.set("WWW-Authenticate", 'Bearer error="invalid_token", error_description="expired"');
    throw new UnauthorizedError("ACCESS_TOKEN_EXPIRED", "Your access token has expired");
  }
  res.set("WWW-Authenticate", 'Bearer error="invalid_token"');
  throw new UnauthorizedError("INVALID_ACCESS_TOKEN", "Your access token is not valid");
}
