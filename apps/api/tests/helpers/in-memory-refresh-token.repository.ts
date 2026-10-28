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

  async rotate(
    currentId: string,
    next: NewRefreshToken,
    at: Date,
  ): Promise<RefreshTokenRecord | null> {
    const current = this.tokens.find((token) => token.id === currentId);
    if (!current || current.revokedAt) return null;
    const replacement = await this.create(next);
    current.revokedAt = at;
    current.replacedById = replacement.id;
    return replacement;
  }

  async revokeFamily(familyId: string, at: Date): Promise<number> {
    const active = this.tokens.filter((token) => token.familyId === familyId && !token.revokedAt);
    for (const token of active) token.revokedAt = at;
    return active.length;
  }
}
