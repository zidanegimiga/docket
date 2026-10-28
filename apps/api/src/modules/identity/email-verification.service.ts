import { createHash, randomBytes } from "node:crypto";

import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import { AppError } from "../../shared/errors/app.error.js";
import type { VerificationTokenRepository } from "./verification.types.js";

export const EMAIL_VERIFICATION_TTL_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;
// 32 random bytes in base64url; anything else cannot be a token we issued.
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface EmailVerificationDeps {
  tokens: VerificationTokenRepository;
  monitor: Monitor;
  /** The URL a user opens to verify, given the raw token. */
  linkFor(token: string): string;
  now?: () => Date;
}

/** Issues the links that prove a user controls their email address, and redeems them. */
export interface EmailVerifier {
  createLink(userId: string): Promise<string>;
}

export class EmailVerificationService implements EmailVerifier {
  constructor(private readonly deps: EmailVerificationDeps) {}

  async createLink(userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.deps.tokens.issueEmailVerification({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(this.now().getTime() + EMAIL_VERIFICATION_TTL_HOURS * HOUR_MS),
    });
    return this.deps.linkFor(token);
  }

  async verify(token: unknown): Promise<void> {
    const outcome =
      typeof token === "string" && TOKEN_FORMAT.test(token)
        ? await this.deps.tokens.verifyEmail(hashToken(token), this.now())
        : ({ status: "invalid" } as const);

    this.deps.monitor.recordMetric("auth.email_verifications", 1, { outcome: outcome.status });

    if (outcome.status === "expired") {
      throw new AppError(410, "VERIFICATION_LINK_EXPIRED", "This verification link has expired");
    }
    if (outcome.status === "invalid") {
      throw new AppError(400, "VERIFICATION_LINK_INVALID", "This verification link is not valid");
    }
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }
}
