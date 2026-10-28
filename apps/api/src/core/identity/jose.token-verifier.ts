import { permissionSchema, userStatusSchema } from "@docket/contracts";
import { createLocalJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

import { ACCESS_TOKEN_TYPE } from "./jose.token-issuer.js";
import type { PublicKeySet, TokenVerification, TokenVerifier } from "./token.interface.js";

export interface VerificationSettings {
  issuer: string;
  audience: string;
  clockToleranceSeconds?: number;
}

const accessTokenPayloadSchema = z.object({
  sub: z.uuid(),
  jti: z.string().min(1),
  exp: z.number().int(),
  status: userStatusSchema,
  permissions: z.array(permissionSchema),
});

export class JoseTokenVerifier implements TokenVerifier {
  constructor(
    private readonly keys: JWTVerifyGetKey,
    private readonly settings: VerificationSettings,
    private readonly now: () => Date = () => new Date(),
  ) {}

  static fromKeySet(keySet: PublicKeySet, settings: VerificationSettings): JoseTokenVerifier {
    return new JoseTokenVerifier(createLocalJWKSet(keySet), settings);
  }

  async verifyAccessToken(token: string): Promise<TokenVerification> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.settings.issuer,
        audience: this.settings.audience,
        algorithms: ["EdDSA"],
        typ: ACCESS_TOKEN_TYPE,
        clockTolerance: this.settings.clockToleranceSeconds ?? 5,
        currentDate: this.now(),
      });

      const claims = accessTokenPayloadSchema.safeParse(payload);
      if (!claims.success) {
        return { valid: false, reason: "invalid" };
      }

      const { sub, jti, exp, status, permissions } = claims.data;
      return {
        valid: true,
        token: { userId: sub, tokenId: jti, expiresAt: new Date(exp * 1000), status, permissions },
      };
    } catch (error) {
      return { valid: false, reason: error instanceof errors.JWTExpired ? "expired" : "invalid" };
    }
  }
}
