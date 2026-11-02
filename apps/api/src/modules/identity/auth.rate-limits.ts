import type { LogInBody, SignUpBody } from "@docket/contracts";
import type { Request } from "express";

import type { RateLimitRule } from "../../shared/middleware/rate-limit.middleware.js";

const email = (req: Request) => (req.body as LogInBody | SignUpBody).email;

/**
 * Limits on the endpoints that guess or spend something. Account-keyed rules are the main defence
 * because they hold whatever proxies sit in front of the API; IP-keyed rules only catch floods from
 * one source and are as accurate as TRUST_PROXY_HOPS. Unknown emails count exactly like real ones,
 * so a limit never reveals whether an account exists.
 */
export const AUTH_RATE_LIMITS = {
  loginPerAccount: {
    name: "login-account",
    limit: 10,
    windowMinutes: 15,
    key: email,
    failuresOnly: true,
    message: "Too many failed sign-in attempts for this account",
  },
  loginPerIp: {
    name: "login-ip",
    limit: 100,
    windowMinutes: 15,
    key: "ip",
    failuresOnly: true,
    message: "Too many failed sign-in attempts from your network",
  },
  // Every sign-up sends an email, so these also stop the endpoint being used to flood an inbox.
  signUpPerEmail: {
    name: "signup-email",
    limit: 3,
    windowMinutes: 60,
    key: email,
    message: "Too many sign-ups for this email address",
  },
  signUpPerIp: {
    name: "signup-ip",
    limit: 20,
    windowMinutes: 60,
    key: "ip",
    message: "Too many sign-ups from your network",
  },
} satisfies Record<string, RateLimitRule>;
