import { describe, expect, it } from "vitest";

import type { TokenCleanupRepository } from "../../src/modules/identity/token-cleanup.repository.js";
import { TokenCleanupService } from "../../src/modules/identity/token-cleanup.service.js";
import { RecordingLogger } from "../helpers/recording.logger.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

class RecordingCleanupRepository implements TokenCleanupRepository {
  cutoffs: Date[] = [];

  async deleteRefreshTokensExpiredBefore(before: Date): Promise<number> {
    this.cutoffs.push(before);
    return 7;
  }

  async deleteVerificationTokensExpiredBefore(before: Date): Promise<number> {
    this.cutoffs.push(before);
    return 2;
  }
}

describe("TokenCleanupService", () => {
  it("deletes tokens that expired more than a day ago and reports how many", async () => {
    const tokens = new RecordingCleanupRepository();
    const monitor = new RecordingMonitor();
    const service = new TokenCleanupService({
      tokens,
      monitor,
      logger: new RecordingLogger(),
      now: () => new Date("2026-11-02T12:00:00Z"),
    });

    await expect(service.run()).resolves.toEqual({ refreshTokens: 7, verificationTokens: 2 });

    expect(tokens.cutoffs).toEqual([
      new Date("2026-11-01T12:00:00Z"),
      new Date("2026-11-01T12:00:00Z"),
    ]);
    expect(monitor.metrics).toEqual([
      { name: "tokens.deleted", value: 7, tags: { kind: "refresh" } },
      { name: "tokens.deleted", value: 2, tags: { kind: "verification" } },
    ]);
  });
});
