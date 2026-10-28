import type { Permission, UserStatus } from "@docket/contracts";

import type { TokenVerifier } from "./token.interface.js";

/** The authenticated caller of a request, as far as authorization is concerned. */
export interface Principal {
  userId: string;
  status: UserStatus;
  permissions: Permission[];
}

export type PrincipalResolution =
  { valid: true; principal: Principal } | { valid: false; reason: "expired" | "invalid" };

/**
 * Turns a presented access token into a principal. Today the token is verified locally; a future
 * user service would back this with its own JWKS or an introspection call.
 */
export interface PrincipalResolver {
  resolve(accessToken: string): Promise<PrincipalResolution>;
}

export class TokenPrincipalResolver implements PrincipalResolver {
  constructor(private readonly verifier: TokenVerifier) {}

  async resolve(accessToken: string): Promise<PrincipalResolution> {
    const result = await this.verifier.verifyAccessToken(accessToken);
    if (!result.valid) return result;

    const { userId, status, permissions } = result.token;
    return { valid: true, principal: { userId, status, permissions } };
  }
}
