import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import type {
  Principal,
  PrincipalResolution,
  PrincipalResolver,
} from "../../src/core/identity/principal.js";
import { authenticate, principalOf } from "../../src/shared/middleware/authenticate.middleware.js";
import { errorHandler } from "../../src/shared/middleware/error-handler.middleware.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

const jane: Principal = {
  userId: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d01",
  status: "active",
  permissions: ["tickets:read"],
};

// Recognises "good" and "stale" tokens; everything else is a forgery.
class StubResolver implements PrincipalResolver {
  async resolve(token: string): Promise<PrincipalResolution> {
    if (token === "good") return { valid: true, principal: jane };
    if (token === "stale") return { valid: false, reason: "expired" };
    return { valid: false, reason: "invalid" };
  }
}

function appWithAuthentication() {
  const app = express();
  app.use(cookieParser());
  app.get(
    "/private",
    authenticate({ resolver: new StubResolver(), accessCookieName: "access" }),
    (req, res) => {
      res.json(principalOf(req));
    },
  );
  app.use(errorHandler(new RecordingMonitor()));
  return app;
}

describe("authenticate", () => {
  const app = appWithAuthentication();

  it.each([
    { label: "an access cookie", headers: { Cookie: "access=good" } },
    { label: "a bearer token", headers: { Authorization: "Bearer good" } },
  ])("accepts $label and exposes the principal", async ({ headers }) => {
    const response = await request(app).get("/private").set(headers);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(jane);
  });

  it("asks for credentials when none are presented", async () => {
    const response = await request(app).get("/private");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(response.headers["www-authenticate"]).toBe("Bearer");
  });

  it("tells the client an expired token can be refreshed", async () => {
    const response = await request(app).get("/private").set("Cookie", "access=stale");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("ACCESS_TOKEN_EXPIRED");
    expect(response.headers["www-authenticate"]).toContain('error="invalid_token"');
  });

  it.each([
    { label: "a forged token", headers: { Cookie: "access=forged" } },
    { label: "a non-bearer scheme", headers: { Authorization: "Basic amFuZTpwdw==" } },
    {
      label: "a bad bearer token, even with a good cookie",
      headers: { Authorization: "Bearer forged", Cookie: "access=good" },
    },
  ])("rejects $label", async ({ headers }) => {
    const response = await request(app).get("/private").set(headers);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });
});
