import type { Permission, UserStatus } from "@docket/contracts";

export interface AccessTokenClaims {
  userId: string;
  status: UserStatus;
  permissions: Permission[];
}

export interface VerifiedAccessToken extends AccessTokenClaims {
  tokenId: string;
  expiresAt: Date;
}

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

export type TokenVerification =
  { valid: true; token: VerifiedAccessToken } | { valid: false; reason: "expired" | "invalid" };

export interface PublicKeySet {
  keys: Record<string, string>[];
}

export interface TokenIssuer {
  issueAccessToken(claims: AccessTokenClaims): Promise<IssuedToken>;
  publicKeys(): PublicKeySet;
}

export interface TokenVerifier {
  verifyAccessToken(token: string): Promise<TokenVerification>;
}
