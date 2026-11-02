import type { PrismaClient } from "../../generated/prisma/client.js";

export interface TokenCleanupRepository {
  /** Deletes refresh tokens that expired before the given time and returns how many. */
  deleteRefreshTokensExpiredBefore(before: Date): Promise<number>;
  /** Deletes email verification tokens that expired before the given time and returns how many. */
  deleteVerificationTokensExpiredBefore(before: Date): Promise<number>;
}

// Small batches keep each statement short, so cleanup never holds locks long enough to slow
// sign-ins, however much has built up.
const BATCH_SIZE = 1000;

export class PrismaTokenCleanupRepository implements TokenCleanupRepository {
  constructor(private readonly db: PrismaClient) {}

  deleteRefreshTokensExpiredBefore(before: Date): Promise<number> {
    return this.inBatches(
      () => this.db.$executeRaw`
        DELETE FROM "refresh_tokens" WHERE "id" IN (
          SELECT "id" FROM "refresh_tokens" WHERE "expires_at" < ${before} LIMIT ${BATCH_SIZE}
        )`,
    );
  }

  deleteVerificationTokensExpiredBefore(before: Date): Promise<number> {
    return this.inBatches(
      () => this.db.$executeRaw`
        DELETE FROM "verification_tokens" WHERE "id" IN (
          SELECT "id" FROM "verification_tokens" WHERE "expires_at" < ${before} LIMIT ${BATCH_SIZE}
        )`,
    );
  }

  private async inBatches(deleteBatch: () => Promise<number>): Promise<number> {
    let total = 0;
    let deleted: number;
    do {
      deleted = await deleteBatch();
      total += deleted;
    } while (deleted === BATCH_SIZE);
    return total;
  }
}
