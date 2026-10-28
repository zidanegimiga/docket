import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { OAuthProviderRegistry } from "../../src/core/identity/oauth/oauth-provider.registry.js";
import { OidcProvider } from "../../src/core/identity/oauth/oidc.provider.js";
import {
  startFakeOidcProvider,
  type FakeOidcProvider,
  type FakeUser,
} from "../helpers/fake-oidc-provider.js";
import { RecordingEmailSender } from "../helpers/recording.email-sender.js";
import { seedUser } from "../helpers/seed-users.js";
import { createTestContainer, resetDatabase, TEST_WEB_ORIGIN } from "../helpers/test-app.js";

const cookieNames = (response: request.Response) =>
  ((response.headers["set-cookie"] as unknown as string[] | undefined) ?? []).map(
    (line) => line.split("=")[0],
  );

describe("OAuth sign-in", () => {
  let container: Container;
  let fake: FakeOidcProvider;
  const email = new RecordingEmailSender();
  // The fake reads these fields when it issues an ID token, so tests change who signs in.
  const fakeUser: FakeUser = { subject: "", email: "", emailVerified: true, name: "" };

  beforeAll(async () => {
    fake = await startFakeOidcProvider(fakeUser);
    container = await createTestContainer({
      emailSender: email,
      oauthProviders: new OAuthProviderRegistry([
        new OidcProvider({
          id: "google",
          displayName: "Google",
          issuer: fake.issuer,
          clientId: fake.clientId,
          clientSecret: fake.clientSecret,
          allowInsecureRequests: true,
        }),
      ]),
    });
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
    await fake.close();
  });

  beforeEach(async () => {
    await resetDatabase(container);
    email.sent.length = 0;
    Object.assign(fakeUser, {
      subject: "google-42",
      email: "jane@example.com",
      emailVerified: true,
      name: "Jane Doe",
    });
  });

  /** Starts sign-in, lets the fake provider approve it and follows the callback. */
  const signInWithGoogle = async (returnTo?: string) => {
    const agent = request.agent(container.app);
    const start = await agent.get("/auth/oauth/google").query(returnTo ? { returnTo } : {});
    const callback = fake.approve(new URL(start.headers["location"]!));
    const response = await agent.get(`${callback.pathname}${callback.search}`);
    return { agent, start, response };
  };

  it("sends the browser to the provider with a short-lived transaction cookie", async () => {
    const start = await request(container.app).get("/auth/oauth/google");

    expect(start.status).toBe(303);
    const location = new URL(start.headers["location"]!);
    expect(location.origin).toBe(fake.issuer.origin);
    expect(location.searchParams.get("redirect_uri")).toBe(
      `${TEST_WEB_ORIGIN}/auth/oauth/google/callback`,
    );
    const [cookie] = start.headers["set-cookie"] as unknown as string[];
    expect(cookie).toMatch(
      /^docket_oauth=.+; Max-Age=600; Path=\/auth\/oauth; .*HttpOnly; SameSite=Lax/,
    );
  });

  it("registers a new user as pending, signs them in and returns them where they started", async () => {
    const { agent, response } = await signInWithGoogle("/tickets?status=open");

    expect(response.status).toBe(303);
    expect(response.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/tickets?status=open`);
    expect(cookieNames(response)).toEqual([
      "docket_oauth",
      "docket_access",
      "docket_refresh",
      "docket_session",
    ]);

    const me = await agent.get("/auth/me");
    expect(me.body.user).toMatchObject({
      email: "jane@example.com",
      name: "Jane Doe",
      status: "pending",
      permissions: [],
      providers: ["google"],
      hasPassword: false,
    });
    expect(email.sent.map((message) => message.to)).toEqual(["jane@example.com"]);
  });

  it("signs a returning user in to the same account", async () => {
    await signInWithGoogle();
    const { response } = await signInWithGoogle();

    expect(response.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/`);
    await expect(container.database.client.user.count()).resolves.toBe(1);
  });

  it("links Google to an existing account with a verified email", async () => {
    const existing = await seedUser(container, { email: "jane@example.com", password: "pw" });
    await container.database.client.user.update({
      where: { id: existing.id },
      data: { emailVerifiedAt: new Date() },
    });

    const { agent } = await signInWithGoogle();

    const me = await agent.get("/auth/me");
    expect(me.body.user).toMatchObject({
      id: existing.id,
      providers: ["google"],
      hasPassword: true,
    });
  });

  it.each([
    {
      label: "the email matches an account that never verified it",
      code: "OAUTH_ACCOUNT_EXISTS",
      arrange: () => seedUser(container, { email: "jane@example.com", password: "pw" }),
    },
    {
      label: "the provider has not verified the email",
      code: "OAUTH_EMAIL_UNVERIFIED",
      arrange: async () => Object.assign(fakeUser, { emailVerified: false }),
    },
    {
      label: "the account is disabled",
      code: "ACCOUNT_DISABLED",
      arrange: async () => {
        await signInWithGoogle();
        await container.database.client.user.updateMany({ data: { status: "disabled" } });
      },
    },
  ])("sends the user back to log in when $label", async ({ code, arrange }) => {
    await arrange();

    const { response } = await signInWithGoogle();

    expect(response.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/login?error=${code}`);
    expect(cookieNames(response)).toEqual(["docket_oauth"]);
    await expect(container.database.client.userIdentity.count()).resolves.toBe(
      code === "ACCOUNT_DISABLED" ? 1 : 0,
    );
  });

  it("refuses a callback from a browser that did not start the sign-in", async () => {
    const start = await request(container.app).get("/auth/oauth/google");
    const callback = fake.approve(new URL(start.headers["location"]!));

    const response = await request(container.app).get(`${callback.pathname}${callback.search}`);

    expect(response.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/login?error=OAUTH_EXPIRED`);
    await expect(container.database.client.user.count()).resolves.toBe(0);
  });

  it("refuses a callback whose state was tampered with", async () => {
    const agent = request.agent(container.app);
    const start = await agent.get("/auth/oauth/google");
    const callback = fake.approve(new URL(start.headers["location"]!));
    callback.searchParams.set("state", "forged");

    const response = await agent.get(`${callback.pathname}${callback.search}`);

    expect(response.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/login?error=OAUTH_FAILED`);
  });

  it("only lets the transaction be used once", async () => {
    const agent = request.agent(container.app);
    const start = await agent.get("/auth/oauth/google");
    const callback = fake.approve(new URL(start.headers["location"]!));
    await agent.get(`${callback.pathname}${callback.search}`);

    const replay = await agent.get(`${callback.pathname}${callback.search}`);

    expect(replay.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/login?error=OAUTH_EXPIRED`);
  });

  it("reports a cancelled sign-in as cancelled", async () => {
    const agent = request.agent(container.app);
    await agent.get("/auth/oauth/google");

    const response = await agent
      .get("/auth/oauth/google/callback")
      .query({ error: "access_denied", state: "whatever" });

    expect(response.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/login?error=OAUTH_CANCELLED`);
  });

  it.each(["//evil.example/path", "https://evil.example", "/\\evil.example"])(
    "never redirects off the web app, even when asked to return to %s",
    async (returnTo) => {
      const { response } = await signInWithGoogle(returnTo);

      expect(response.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/`);
    },
  );

  it("sends an unknown provider back to log in", async () => {
    const response = await request(container.app).get("/auth/oauth/myspace");

    expect(response.headers["location"]).toBe(`${TEST_WEB_ORIGIN}/login?error=NOT_FOUND`);
  });
});
