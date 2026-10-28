import { randomUUID } from "node:crypto";

import { SignJWT } from "jose";

import type { SigningKey } from "./signing-key.js";
import type {
  AccessTokenClaims,
  IssuedToken,
  PublicKeySet,
  TokenIssuer,
} from "./token.interface.js";

export const ACCESS_TOKEN_TYPE = "at+jwt";

export interface TokenSettings {
  issuer: string;
  audience: string;
  accessTokenTtlSeconds: number;
}

export class JoseTokenIssuer implements TokenIssuer {
  constructor(
    private readonly key: SigningKey,
    private readonly settings: TokenSettings,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issueAccessToken({ userId, status, permissions }: AccessTokenClaims): Promise<IssuedToken> {
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const expiresAt = issuedAt + this.settings.accessTokenTtlSeconds;

    const token = await new SignJWT({ status, permissions })
      .setProtectedHeader({ alg: "EdDSA", kid: this.key.kid, typ: ACCESS_TOKEN_TYPE })
      .setSubject(userId)
      .setIssuer(this.settings.issuer)
      .setAudience(this.settings.audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .setJti(randomUUID())
      .sign(this.key.privateKey);

    return { token, expiresAt: new Date(expiresAt * 1000) };
  }

  publicKeys(): PublicKeySet {
    return { keys: [this.key.publicJwk] };
  }
}
