import type { Request, RequestHandler } from "express";
import {
  ipKeyGenerator,
  MemoryStore,
  rateLimit,
  type RateLimitInfo,
  type Store,
} from "express-rate-limit";

import { AppError } from "../errors/app.error.js";

/** Creates the storage behind one rule; in memory today, a shared store such as Redis later. */
export type RateLimitStoreFactory = (ruleName: string) => Store;

export const memoryRateLimitStore: RateLimitStoreFactory = () => new MemoryStore();

export interface RateLimitRule {
  /** Unique per rule; also names the store. */
  name: string;
  limit: number;
  windowMinutes: number;
  /**
   * What requests are counted against: the caller's IP, or a value from the validated request
   * such as the email being signed in to. Place the limiter after validate() when using the body.
   */
  key: "ip" | ((req: Request) => string);
  /** Count only failed requests, so people who get it right are never slowed down. */
  failuresOnly?: boolean;
  /** Shown to the user, followed by when to try again. */
  message: string;
}

export interface RateLimitSettings {
  enabled: boolean;
  store: RateLimitStoreFactory;
}

const passThrough: RequestHandler = (_req, _res, next) => next();

/** Rejects requests over the rule's limit with 429 RATE_LIMITED and standard RateLimit headers. */
export function rateLimiter(
  rule: RateLimitRule,
  { enabled, store }: RateLimitSettings,
): RequestHandler {
  if (!enabled) return passThrough;

  const windowMs = rule.windowMinutes * 60_000;
  return rateLimit({
    windowMs,
    limit: rule.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    identifier: rule.name,
    skipSuccessfulRequests: rule.failuresOnly ?? false,
    store: store(rule.name),
    keyGenerator: (req) =>
      // ipKeyGenerator groups IPv6 addresses by network, since one client often holds many.
      rule.key === "ip" ? ipKeyGenerator(req.ip ?? "unknown") : rule.key(req),
    handler: (req, _res, next) => {
      // The library records its counters on the request without declaring the property.
      const info = (req as Request & { rateLimit?: RateLimitInfo }).rateLimit;
      const resetAt = info?.resetTime?.getTime() ?? Date.now() + windowMs;
      const minutes = Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000));
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          `${rule.message}. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
        ),
      );
    },
  });
}
