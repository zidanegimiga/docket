import { createLocalJWKSet, jwtVerify } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { OAuthProviderRegistry } from "../../src/core/identity/oauth/oauth-provider.registry.js";
import type { OAuthProvider } from "../../src/core/identity/oauth/oauth-provider.interface.js";
import { seedUser } from "../helpers/seed-users.js";
import { createTestContainer, resetDatabase, TEST_WEB_ORIGIN } from "../helpers/test-app.js";

const password = "correct horse battery";

const unusedProvider = (id: string, displayName: string): OAuthProvider => ({
  id,
  displayName,
  createAuthorizationUrl: () => Promise.reject(new Error("not used")),
  completeAuthorization: () => Promise.reject(new Error("not used")),
});

const cookieValue = (response: request.Response, name: string) => {
  const header = response.headers["set-cookie"] as unknown as string[] | undefined;
  const line = header?.find((value) => value.startsWith(`${name}=`));
  return line?.split(";")[0]!.slice(name.length + 1);
};

describe("current user, providers and public keys", () => {
  let container: Container;

  beforeAll(async () => {
    container = await createTestContainer({
      oauthProviders: new OAuthProviderRegistry([unusedProvider("google", "Google")]),
    });
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
  });

  const signIn = async (status: "active" | "pending" = "active") => {
    const user = await seedUser(container, {
      email: "jane@example.com",
      password,
      status,
      roles: ["member"],
    });
    const agent = request.agent(container.app).set("Origin", TEST_WEB_ORIGIN);
    const login = await agent.post("/auth/login").send({ email: user.email, password });
    return { user, agent, accessToken: cookieValue(login, "docket_access")! };
  };

  describe("GET /auth/me", () => {
    it("returns the signed-in user from the session cookie", async () => {
      const { user, agent } = await signIn();

      const response = await agent.get("/auth/me");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body.user).toMatchObject({
        id: user.id,
        email: "jane@example.com",
        status: "active",
        permissions: expect.arrayContaining(["tickets:read", "tickets:create"]),
        hasPassword: true,
      });
    });

    it("accepts the access token as a bearer token", async () => {
      const { user, accessToken } = await signIn();

      const response = await request(container.app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.body.user.id).toBe(user.id);
    });

    it("lets a pending user in without any permissions", async () => {
      const { agent } = await signIn("pending");

      const response = await agent.get("/auth/me");

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({ status: "pending", permissions: [] });
    });

    it("ends the session of a user disabled after signing in", async () => {
      const { user, agent } = await signIn();
      await container.database.client.user.update({
        where: { id: user.id },
        data: { status: "disabled" },
      });

      const response = await agent.get("/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("SESSION_EXPIRED");
    });

    it("requires a session", async () => {
      const response = await request(container.app).get("/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });
  });

  describe("GET /auth/providers", () => {
    it("lists the configured sign-in providers", async () => {
      const response = await request(container.app).get("/auth/providers");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ providers: [{ id: "google", name: "Google" }] });
    });
  });

  describe("GET /.well-known/jwks.json", () => {
    it("publishes only public keys, cacheably", async () => {
      const response = await request(container.app).get("/.well-known/jwks.json");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("application/jwk-set+json");
      expect(response.headers["cache-control"]).toBe("public, max-age=300");
      expect(response.body.keys).toEqual([
        {
          kty: "OKP",
          crv: "Ed25519",
          x: expect.any(String),
          kid: expect.any(String),
          alg: "EdDSA",
          use: "sig",
        },
      ]);
    });

    it("lets another service verify an access token with nothing but the published keys", async () => {
      const { user, accessToken } = await signIn();
      const { body: keySet } = await request(container.app).get("/.well-known/jwks.json");

      const { payload } = await jwtVerify(accessToken, createLocalJWKSet(keySet), {
        issuer: container.env.AUTH_ISSUER,
        audience: container.env.AUTH_AUDIENCE,
      });

      expect(payload.sub).toBe(user.id);
    });
  });
});
