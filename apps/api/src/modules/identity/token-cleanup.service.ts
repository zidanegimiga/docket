import type { Logger } from "../../core/logger/logger.interface.js";
import type { Monitor } from "../../core/monitoring/monitor.interface.js";
import type { TokenCleanupRepository } from "./token-cleanup.repository.js";

/**
 * Expired tokens are kept for a day before deletion. Until a refresh token expires it must stay,
 * rotated or not, because finding a replayed old token is how stolen sessions are detected; and a
 * used verification link stays so a second click still reports success.
 */
export const TOKEN_RETENTION_AFTER_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface TokenCleanupResult {
  refreshTokens: number;
  verificationTokens: number;
}

export interface TokenCleanupDeps {
  tokens: TokenCleanupRepository;
  logger: Logger;
  monitor: Monitor;
  now?: () => Date;
}

export class TokenCleanupService {
  constructor(private readonly deps: TokenCleanupDeps) {}

  async run(): Promise<TokenCleanupResult> {
    const now = this.deps.now?.() ?? new Date();
    const before = new Date(now.getTime() - TOKEN_RETENTION_AFTER_EXPIRY_MS);

    const result = {
      refreshTokens: await this.deps.tokens.deleteRefreshTokensExpiredBefore(before),
      verificationTokens: await this.deps.tokens.deleteVerificationTokensExpiredBefore(before),
    };

    this.deps.monitor.recordMetric("tokens.deleted", result.refreshTokens, { kind: "refresh" });
    this.deps.monitor.recordMetric("tokens.deleted", result.verificationTokens, {
      kind: "verification",
    });
    this.deps.logger.info("Expired tokens deleted", { ...result, expiredBefore: before });
    return result;
  }
}
