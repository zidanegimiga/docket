import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { hashRefreshToken } from "../../src/modules/identity/auth.service.js";
import { seedUser } from "../helpers/seed-users.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

interface ParsedCookie {
  name: string;
  value: string;
  attributes: Record<string, string | true>;
}

function parseSetCookies(header: string[] | string | undefined): ParsedCookie[] {
  const lines = Array.isArray(header) ? header : header ? [header] : [];
  return lines.map((line) => {
    const [pair, ...attributes] = line.split(";").map((part) => part.trim());
    const [name, ...value] = pair!.split("=");
    return {
      name: name!,
      value: value.join("="),
      attributes: Object.fromEntries(
        attributes.map((attribute) => {
          const [key, ...rest] = attribute.split("=");
          return [key!.toLowerCase(), rest.length ? rest.join("=") : true];
        }),
      ),
    };
  });
}

describe("POST /auth/login", () => {
  let container: Container;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
  });

  const password = "correct horse battery";
  const logIn = (body: object) =>
    request(container.app).post("/auth/login").set("User-Agent", "Integration test").send(body);

  it("signs in an active member and sets httpOnly session cookies", async () => {
    const user = await seedUser(container, {
      email: "jane@example.com",
      password,
      roles: ["member"],
    });

    const response = await logIn({ email: "Jane@Example.com", password });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.user).toMatchObject({
      id: user.id,
      status: "active",
      permissions: ["tickets:read", "tickets:create", "tickets:update:own"],
      hasPassword: true,
    });

    const cookies = parseSetCookies(response.headers["set-cookie"]);
    expect(cookies.map((cookie) => cookie.name)).toEqual([
      "docket_access",
      "docket_refresh",
      "docket_session",
    ]);
    const [access, refresh] = cookies;
    expect(access!.attributes).toMatchObject({ path: "/", httponly: true, samesite: "Lax" });
    expect(refresh!.attributes).toMatchObject({ path: "/auth", httponly: true, samesite: "Lax" });

    const verified = await container.identity.tokenVerifier.verifyAccessToken(access!.value);
    expect(verified).toMatchObject({ valid: true, token: { userId: user.id, status: "active" } });

    const stored = await container.database.client.refreshToken.findMany();
    expect(stored).toEqual([
      expect.objectContaining({
        userId: user.id,
        tokenHash: hashRefreshToken(decodeURIComponent(refresh!.value)),
        userAgent: "Integration test",
        revokedAt: null,
      }),
    ]);
  });

  it("gives a wrong password and an unknown email the same answer and no cookies", async () => {
    await seedUser(container, { email: "jane@example.com", password });

    const wrong = await logIn({ email: "jane@example.com", password: "wrong password" });
    const unknown = await logIn({ email: "nobody@example.com", password });

    for (const response of [wrong, unknown]) {
      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect",
      });
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
    await expect(container.database.client.refreshToken.count()).resolves.toBe(0);
  });

  it("lets a pending user in with no permissions", async () => {
    await seedUser(container, {
      email: "new@example.com",
      password,
      status: "pending",
      roles: ["admin"],
    });

    const response = await logIn({ email: "new@example.com", password });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ status: "pending", permissions: [] });
  });

  it("refuses a disabled account with the right password", async () => {
    await seedUser(container, { email: "gone@example.com", password, status: "disabled" });

    const response = await logIn({ email: "gone@example.com", password });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ACCOUNT_DISABLED");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("records the login time", async () => {
    const user = await seedUser(container, { email: "jane@example.com", password });

    await logIn({ email: "jane@example.com", password });

    const stored = await container.database.client.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.lastLoginAt).toBeInstanceOf(Date);
  });
});
