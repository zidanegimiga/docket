import { afterEach, describe, expect, it } from "vitest";

import { createAuthorizationRequest } from "../../src/core/identity/oauth/authorization-request.js";
import { OAuthCallbackError } from "../../src/core/identity/oauth/oauth-provider.interface.js";
import { OAuthProviderRegistry } from "../../src/core/identity/oauth/oauth-provider.registry.js";
import { OidcProvider } from "../../src/core/identity/oauth/oidc.provider.js";
import {
  startFakeOidcProvider,
  type FakeOidcProvider,
  type FakeUser,
} from "../helpers/fake-oidc-provider.js";

const redirectUri = "http://localhost:3000/api/auth/oauth/fake/callback";
const user: FakeUser = {
  subject: "fake-user-42",
  email: "Jane.Doe@Example.com",
  emailVerified: true,
  name: "Jane Doe",
};

describe("OidcProvider", () => {
  let fake: FakeOidcProvider | undefined;

  afterEach(async () => {
    await fake?.close();
    fake = undefined;
  });

  const setup = async (overrides: Partial<FakeUser> = {}) => {
    fake = await startFakeOidcProvider({ ...user, ...overrides });
    const provider = new OidcProvider({
      id: "fake",
      displayName: "Fake",
      issuer: fake.issuer,
      clientId: fake.clientId,
      clientSecret: fake.clientSecret,
      allowInsecureRequests: true,
    });
    const request = createAuthorizationRequest(redirectUri);
    const authorizationUrl = await provider.createAuthorizationUrl(request);
    return { fake, provider, request, authorizationUrl };
  };

  it("builds an authorization URL with PKCE, state and nonce", async () => {
    const { authorizationUrl, request, fake } = await setup();
    const params = authorizationUrl.searchParams;

    expect(authorizationUrl.pathname).toBe("/authorize");
    expect(Object.fromEntries(params)).toMatchObject({
      response_type: "code",
      client_id: fake.clientId,
      redirect_uri: redirectUri,
      scope: "openid email profile",
      state: request.state,
      nonce: request.nonce,
      code_challenge_method: "S256",
    });
    expect(params.get("code_challenge")).not.toBe(request.codeVerifier);
    expect(params.has("client_secret")).toBe(false);
  });

  it("returns the external identity after a successful sign-in", async () => {
    const { fake, provider, request, authorizationUrl } = await setup();

    const identity = await provider.completeAuthorization(fake.approve(authorizationUrl), request);

    expect(identity).toEqual({
      provider: "fake",
      subject: "fake-user-42",
      email: "jane.doe@example.com",
      emailVerified: true,
      name: "Jane Doe",
    });
  });

  it("reports an unverified email as unverified", async () => {
    const { fake, provider, request, authorizationUrl } = await setup({ emailVerified: false });

    const identity = await provider.completeAuthorization(fake.approve(authorizationUrl), request);

    expect(identity.emailVerified).toBe(false);
  });

  it("rejects a callback whose state does not match the request", async () => {
    const { fake, provider, request, authorizationUrl } = await setup();
    const callback = fake.approve(authorizationUrl);
    callback.searchParams.set("state", "attacker-state");

    await expect(provider.completeAuthorization(callback, request)).rejects.toBeInstanceOf(
      OAuthCallbackError,
    );
  });

  it("rejects an ID token issued for a different nonce", async () => {
    const { fake, provider, request, authorizationUrl } = await setup();
    const callback = fake.approve(authorizationUrl, { nonceOverride: "replayed-nonce" });

    await expect(provider.completeAuthorization(callback, request)).rejects.toBeInstanceOf(
      OAuthCallbackError,
    );
  });

  it("rejects a code redeemed without the original PKCE verifier", async () => {
    const { fake, provider, request, authorizationUrl } = await setup();
    const callback = fake.approve(authorizationUrl);
    const stolenCodeAttempt = {
      ...request,
      codeVerifier: createAuthorizationRequest(redirectUri).codeVerifier,
    };

    await expect(
      provider.completeAuthorization(callback, stolenCodeAttempt),
    ).rejects.toBeInstanceOf(OAuthCallbackError);
  });

  it("rejects a callback reporting that the user declined", async () => {
    const { provider, request } = await setup();
    const declined = new URL(redirectUri);
    declined.searchParams.set("error", "access_denied");
    declined.searchParams.set("state", request.state);

    await expect(provider.completeAuthorization(declined, request)).rejects.toBeInstanceOf(
      OAuthCallbackError,
    );
  });
});

describe("createAuthorizationRequest", () => {
  it("generates fresh, unguessable values for every sign-in", () => {
    const first = createAuthorizationRequest(redirectUri);
    const second = createAuthorizationRequest(redirectUri);

    expect(first.state).not.toBe(second.state);
    expect(first.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Set([first.state, first.nonce, first.codeVerifier]).size).toBe(3);
  });
});

describe("OAuthProviderRegistry", () => {
  const provider = (id: string) =>
    new OidcProvider({
      id,
      displayName: id.toUpperCase(),
      issuer: new URL("https://issuer.example"),
      clientId: "id",
      clientSecret: "secret",
    });

  it("finds providers by id and lists them for the login page", () => {
    const registry = new OAuthProviderRegistry([provider("google"), provider("microsoft")]);

    expect(registry.get("google")?.id).toBe("google");
    expect(registry.get("github")).toBeUndefined();
    expect(registry.list()).toEqual([
      { id: "google", name: "GOOGLE" },
      { id: "microsoft", name: "MICROSOFT" },
    ]);
  });

  it("refuses two providers with the same id", () => {
    expect(() => new OAuthProviderRegistry([provider("google"), provider("google")])).toThrow(
      "registered twice",
    );
  });
});
