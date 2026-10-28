import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { createTestContainer } from "../helpers/test-app.js";

describe("security headers", () => {
  let container: Container;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  it.each([
    { label: "a successful response", path: "/health" },
    { label: "an error response", path: "/does-not-exist" },
  ])("are set on $label", async ({ path }) => {
    const response = await request(container.app).get(path);

    expect(response.headers).toMatchObject({
      "content-security-policy": "default-src 'none';frame-ancestors 'none'",
      "strict-transport-security": expect.stringContaining("max-age="),
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "cross-origin-resource-policy": "same-origin",
    });
    expect(response.headers).not.toHaveProperty("x-powered-by");
  });

  it("does not open the API to other origins", async () => {
    const response = await request(container.app)
      .options("/tickets/1")
      .set("Origin", "https://example.com")
      .set("Access-Control-Request-Method", "PATCH");

    expect(response.headers).not.toHaveProperty("access-control-allow-origin");
  });
});
