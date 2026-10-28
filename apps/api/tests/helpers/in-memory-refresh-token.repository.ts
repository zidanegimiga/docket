import { randomUUID } from "node:crypto";

import type {
  NewRefreshToken,
  RefreshTokenRecord,
  RefreshTokenRepository,
} from "../../src/modules/identity/session.types.js";

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly tokens: RefreshTokenRecord[] = [];

  async create(token: NewRefreshToken): Promise<RefreshTokenRecord> {
    const record = {
      ...token,
      id: randomUUID(),
      revokedAt: null,
      replacedById: null,
      createdAt: new Date(),
    };
    this.tokens.push(record);
    return record;
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }
}
