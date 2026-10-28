import type { Permission, UserStatus } from "@docket/contracts";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  requireAnyPermission,
  requirePermission,
} from "../../src/shared/middleware/authorize.middleware.js";
import { errorHandler } from "../../src/shared/middleware/error-handler.middleware.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

function appFor(status: UserStatus, permissions: Permission[]) {
  const app = express();
  app.use((req, _res, next) => {
    req.principal = { userId: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d01", status, permissions };
    next();
  });
  app.get("/read", requirePermission("tickets:read"), (_req, res) => {
    res.end("ok");
  });
  app.get(
    "/update",
    requireAnyPermission("tickets:update:own", "tickets:update:any"),
    (_req, res) => {
      res.end("ok");
    },
  );
  app.use(errorHandler(new RecordingMonitor()));
  return app;
}

describe("permission checks", () => {
  it("lets a caller with the permission through", async () => {
    await expect(request(appFor("active", ["tickets:read"])).get("/read")).resolves.toMatchObject({
      status: 200,
    });
  });

  it("denies a caller without the permission", async () => {
    const response = await request(appFor("active", ["tickets:create"])).get("/read");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it.each<Permission[]>([["tickets:update:own"], ["tickets:update:any"]])(
    "accepts any one of several permissions (%s)",
    async (permission) => {
      await expect(request(appFor("active", [permission])).get("/update")).resolves.toMatchObject({
        status: 200,
      });
    },
  );

  it("tells a pending user their account still needs approval", async () => {
    const response = await request(appFor("pending", [])).get("/read");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ACCOUNT_PENDING");
  });

  it("refuses to run without an authenticated caller", async () => {
    const app = express();
    app.get("/read", requirePermission("tickets:read"), (_req, res) => {
      res.end("ok");
    });
    app.use(errorHandler(new RecordingMonitor()));

    await expect(request(app).get("/read")).resolves.toMatchObject({ status: 500 });
  });
});
