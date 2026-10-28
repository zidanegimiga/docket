import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

interface PendingCode {
  codeChallenge: string;
  nonce: string;
  redirectUri: string;
}

export interface FakeUser {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface FakeOidcProvider {
  issuer: URL;
  clientId: string;
  clientSecret: string;
  approve(authorizationUrl: URL, options?: { nonceOverride?: string }): URL;
  close(): Promise<void>;
}

export async function startFakeOidcProvider(user: FakeUser): Promise<FakeOidcProvider> {
  const clientId = "test-client";
  const clientSecret = "test-secret";
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
  const codes = new Map<string, PendingCode>();

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", issuer);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/.well-known/openid-configuration") {
      return json(200, {
        issuer: issuer.href.replace(/\/$/, ""),
        authorization_endpoint: new URL("/authorize", issuer).href,
        token_endpoint: new URL("/token", issuer).href,
        jwks_uri: new URL("/jwks", issuer).href,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
      });
    }

    if (url.pathname === "/jwks") {
      return json(200, { keys: [publicJwk] });
    }

    if (url.pathname === "/token" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const form = new URLSearchParams(raw);
      const pending = codes.get(form.get("code") ?? "");
      codes.delete(form.get("code") ?? "");

      const basic = req.headers.authorization?.startsWith("Basic ")
        ? Buffer.from(req.headers.authorization.slice(6), "base64").toString()
        : null;
      const [sentId, sentSecret] = basic
        ? basic.split(":").map(decodeURIComponent)
        : [form.get("client_id"), form.get("client_secret")];
      const verifier = form.get("code_verifier") ?? "";
      const challenge = createHash("sha256").update(verifier).digest("base64url");

      if (sentId !== clientId || sentSecret !== clientSecret) {
        return json(401, { error: "invalid_client" });
      }
      if (!pending || pending.codeChallenge !== challenge) {
        return json(400, { error: "invalid_grant" });
      }
      if (form.get("redirect_uri") !== pending.redirectUri) {
        return json(400, { error: "invalid_grant" });
      }

      const idToken = await new SignJWT({
        email: user.email,
        email_verified: user.emailVerified,
        name: user.name,
        nonce: pending.nonce,
      })
        .setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuer(issuer.href.replace(/\/$/, ""))
        .setAudience(clientId)
        .setSubject(user.subject)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);

      return json(200, {
        access_token: "fake-access-token",
        token_type: "Bearer",
        expires_in: 300,
        id_token: idToken,
      });
    }

    json(404, { error: "not_found" });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const issuer = new URL(`http://127.0.0.1:${port}`);

  return {
    issuer,
    clientId,
    clientSecret,
    approve(authorizationUrl, options = {}) {
      const params = authorizationUrl.searchParams;
      const code = randomBytes(16).toString("base64url");
      codes.set(code, {
        codeChallenge: params.get("code_challenge") ?? "",
        nonce: options.nonceOverride ?? params.get("nonce") ?? "",
        redirectUri: params.get("redirect_uri") ?? "",
      });
      const callback = new URL(params.get("redirect_uri") ?? "");
      callback.searchParams.set("code", code);
      callback.searchParams.set("state", params.get("state") ?? "");
      return callback;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
