import { describe, expect, it } from "vitest";

import { HealthService } from "../../src/modules/health/health.service.js";
import { FakeDatabase } from "../helpers/fake.database.js";

describe("HealthService.check", () => {
  it("reports ok when the database is reachable", async () => {
    const service = new HealthService(new FakeDatabase());

    await expect(service.check()).resolves.toEqual({
      status: "ok",
      checks: { database: "up" },
    });
  });

  it("reports degraded when the database is unreachable", async () => {
    const database = new FakeDatabase();
    database.healthy = false;

    await expect(new HealthService(database).check()).resolves.toEqual({
      status: "degraded",
      checks: { database: "down" },
    });
  });
});
