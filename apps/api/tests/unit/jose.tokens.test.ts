import { randomUUID } from "node:crypto";

import { decodeProtectedHeader, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { JoseTokenIssuer } from "../../src/core/identity/jose.token-issuer.js";
import { JoseTokenVerifier } from "../../src/core/identity/jose.token-verifier.js";
import {
  generateSigningKeyJwk,
  loadSigningKey,
  type SigningKey,
} from "../../src/core/identity/signing-key.js";
import type { AccessTokenClaims } from "../../src/core/identity/token.interface.js";

const settings = { issuer: "docket-test", audience: "docket-api", accessTokenTtlSeconds: 600 };
const claims: AccessTokenClaims = {
  userId: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d01",
  status: "active",
  permissions: ["tickets:read", "tickets:create"],
};

describe("JWT access tokens", () => {
  let key: SigningKey;
  let otherKey: SigningKey;

  beforeAll(async () => {
    key = await loadSigningKey(await generateSigningKeyJwk());
    otherKey = await loadSigningKey(await generateSigningKeyJwk());
  });

  const issuer = (now?: () => Date) => new JoseTokenIssuer(key, settings, now);
  const verifier = (overrides: Partial<typeof settings> = {}) =>
    JoseTokenVerifier.fromKeySet(issuer().publicKeys(), { ...settings, ...overrides });

  it("round-trips the claims of a freshly issued token", async () => {
    const { token, expiresAt } = await issuer().issueAccessToken(claims);

    const result = await verifier().verifyAccessToken(token);

    expect(result).toMatchObject({ valid: true, token: { ...claims, expiresAt } });
    expect(decodeProtectedHeader(token)).toEqual({ alg: "EdDSA", kid: key.kid, typ: "at+jwt" });
  });

  it("reports an expired token as expired, not merely invalid", async () => {
    const twentyMinutesAgo = () => new Date(Date.now() - 20 * 60_000);
    const { token } = await issuer(twentyMinutesAgo).issueAccessToken(claims);

    await expect(verifier().verifyAccessToken(token)).resolves.toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it.each([
    ["the wrong audience", { audience: "another-service" }],
    ["the wrong issuer", { issuer: "someone-else" }],
  ])("rejects a token checked against %s", async (_, overrides) => {
    const { token } = await issuer().issueAccessToken(claims);

    await expect(verifier(overrides).verifyAccessToken(token)).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects a token whose payload was edited to add a permission", async () => {
    const { token } = await issuer().issueAccessToken(claims);
    const [header, payload, signature] = token.split(".");
    const edited = JSON.parse(Buffer.from(payload!, "base64url").toString());
    edited.permissions.push("users:manage");
    const forged = [header, Buffer.from(JSON.stringify(edited)).toString("base64url"), signature];

    await expect(verifier().verifyAccessToken(forged.join("."))).resolves.toMatchObject({
      valid: false,
    });
  });

  it("rejects a token signed by a different key, even with the trusted key id", async () => {
    const forged = await new SignJWT({ status: "active", permissions: ["users:manage"] })
      .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: "at+jwt" })
      .setSubject(claims.userId)
      .setIssuer(settings.issuer)
      .setAudience(settings.audience)
      .setIssuedAt()
      .setExpirationTime("10m")
      .setJti(randomUUID())
      .sign(otherKey.privateKey);

    await expect(verifier().verifyAccessToken(forged)).resolves.toMatchObject({ valid: false });
  });

  it("rejects an unsigned token using alg none", async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "none", typ: "at+jwt" })}.${encode({
      sub: claims.userId,
      iss: settings.issuer,
      aud: settings.audience,
      exp: Math.floor(Date.now() / 1000) + 600,
      jti: randomUUID(),
      status: "active",
      permissions: ["users:manage"],
    })}.`;

    await expect(verifier().verifyAccessToken(unsigned)).resolves.toMatchObject({ valid: false });
  });

  it("rejects a correctly signed token carrying an unknown permission", async () => {
    const { token } = await issuer().issueAccessToken({
      ...claims,
      permissions: ["tickets:delete" as never],
    });

    await expect(verifier().verifyAccessToken(token)).resolves.toMatchObject({ valid: false });
  });

  it("rejects strings that are not tokens at all", async () => {
    for (const garbage of ["", "abc", "a.b.c"]) {
      await expect(verifier().verifyAccessToken(garbage)).resolves.toMatchObject({ valid: false });
    }
  });

  it("publishes only the public half of the key", () => {
    const [published] = issuer().publicKeys().keys;

    expect(published).toEqual({
      kty: "OKP",
      crv: "Ed25519",
      x: expect.any(String),
      kid: key.kid,
      alg: "EdDSA",
      use: "sig",
    });
    expect(published).not.toHaveProperty("d");
  });
});

describe("loadSigningKey", () => {
  it.each([
    ["text that is not JSON", "not json", "must be a JSON Web Key"],
    ["a key without a kid", JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "a", d: "b" }), "kid"],
    ["an RSA key", JSON.stringify({ kty: "RSA", n: "a", e: "AQAB", d: "b", kid: "k" }), "Ed25519"],
    [
      "a public key only",
      JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "a", kid: "k" }),
      "private",
    ],
  ])("rejects %s with a clear message", async (_, value, message) => {
    await expect(loadSigningKey(value)).rejects.toThrow(message);
  });
});
