import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../src/shared/middleware/error-handler.middleware.js";
import {
  memoryRateLimitStore,
  rateLimiter,
  type RateLimitRule,
} from "../../src/shared/middleware/rate-limit.middleware.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

const rule: RateLimitRule = {
  name: "test",
  limit: 2,
  windowMinutes: 15,
  key: "ip",
  message: "Too many tries",
};

/** A route that fails when ?fail is present, behind the given rule. */
function appWith(overrides: Partial<RateLimitRule> = {}, enabled = true) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.post(
    "/try",
    rateLimiter({ ...rule, ...overrides }, { enabled, store: memoryRateLimitStore }),
    (req, res) => {
      res.status(req.query["fail"] === undefined ? 200 : 401).end();
    },
  );
  app.use(errorHandler(new RecordingMonitor()));
  return app;
}

const from = (app: express.Express, ip: string, path = "/try") =>
  request(app).post(path).set("X-Forwarded-For", ip).send({ email: "jane@example.com" });

describe("rateLimiter", () => {
  it("answers 429 with the error envelope and standard headers once the limit is reached", async () => {
    const app = appWith();
    await from(app, "203.0.113.1");
    await from(app, "203.0.113.1");

    const response = await from(app, "203.0.113.1");

    expect(response.status).toBe(429);
    expect(response.body.error).toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many tries. Try again in 15 minutes.",
    });
    expect(response.headers["ratelimit-policy"]).toMatch(
      /^"test"; q=2; w=900; pk=:[A-Za-z0-9+/=]+:$/,
    );
    expect(response.headers["retry-after"]).toBe("900");
  });

  it("keeps a separate count per address", async () => {
    const app = appWith();
    await from(app, "203.0.113.1");
    await from(app, "203.0.113.1");

    await expect(from(app, "203.0.113.2")).resolves.toMatchObject({ status: 200 });
  });

  it("treats addresses in the same IPv6 network as one client", async () => {
    const app = appWith();
    await from(app, "2001:db8:1:2::1");
    await from(app, "2001:db8:1:2::ffff");

    await expect(from(app, "2001:db8:1:2:abcd::9")).resolves.toMatchObject({ status: 429 });
  });

  it("can count failures only", async () => {
    const app = appWith({ failuresOnly: true });
    for (let i = 0; i < 5; i++) await from(app, "203.0.113.1");
    await from(app, "203.0.113.1", "/try?fail");
    await from(app, "203.0.113.1", "/try?fail");

    await expect(from(app, "203.0.113.1")).resolves.toMatchObject({ status: 429 });
  });

  it("can key on something other than the address", async () => {
    const app = appWith({ key: (req) => (req.body as { email: string }).email });
    await from(app, "203.0.113.1");
    await from(app, "203.0.113.2");

    await expect(from(app, "203.0.113.3")).resolves.toMatchObject({ status: 429 });
  });

  it("does nothing when rate limiting is switched off", async () => {
    const app = appWith({}, false);
    for (let i = 0; i < 5; i++) {
      await expect(from(app, "203.0.113.1")).resolves.toMatchObject({ status: 200 });
    }
  });
});
