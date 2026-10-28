import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { createTestContainer, TEST_WEB_ORIGIN } from "../helpers/test-app.js";

const SESSION_COOKIE = "docket_refresh=not-a-real-token";

describe("origin check", () => {
  let container: Container;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  const logOut = (headers: Record<string, string>) =>
    request(container.app).post("/auth/logout").set(headers);

  it.each<{ label: string; headers: Record<string, string> }>([
    {
      label: "the web app calling through its own proxy",
      headers: { "Sec-Fetch-Site": "same-origin", Cookie: SESSION_COOKIE },
    },
    {
      label: "the web app calling from its origin",
      headers: { "Sec-Fetch-Site": "same-site", Origin: TEST_WEB_ORIGIN, Cookie: SESSION_COOKIE },
    },
    {
      label: "an older browser that only sends Origin",
      headers: { Origin: TEST_WEB_ORIGIN, Cookie: SESSION_COOKIE },
    },
    { label: "a server-to-server call without cookies", headers: {} },
  ])("allows $label", async ({ headers }) => {
    await expect(logOut(headers)).resolves.toMatchObject({ status: 204 });
  });

  it.each<{ label: string; headers: Record<string, string> }>([
    {
      label: "a form posted from another site",
      headers: {
        "Sec-Fetch-Site": "cross-site",
        Origin: "https://evil.example",
        Cookie: SESSION_COOKIE,
      },
    },
    {
      label: "a sibling subdomain",
      headers: {
        "Sec-Fetch-Site": "same-site",
        Origin: "http://other.localhost:3000",
        Cookie: SESSION_COOKIE,
      },
    },
    {
      label: "an opaque origin from a sandboxed frame",
      headers: { Origin: "null", Cookie: SESSION_COOKIE },
    },
    {
      label: "a foreign origin without Sec-Fetch-Site",
      headers: { Origin: "https://evil.example" },
    },
    {
      label: "cookies with no browser headers to vouch for them",
      headers: { Cookie: SESSION_COOKIE },
    },
  ])("rejects $label", async ({ headers }) => {
    const response = await logOut(headers);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CROSS_ORIGIN_REQUEST");
  });

  it("leaves reads from other origins alone", async () => {
    const response = await request(container.app).get("/health").set({
      "Sec-Fetch-Site": "cross-site",
      Origin: "https://evil.example",
      Cookie: SESSION_COOKIE,
    });

    expect(response.status).toBe(200);
  });

  it("rejects before the body is parsed", async () => {
    const response = await request(container.app)
      .post("/tickets")
      .set({ "Sec-Fetch-Site": "cross-site", Origin: "https://evil.example" })
      .type("json")
      .send("{not json");

    expect(response.status).toBe(403);
  });
});
