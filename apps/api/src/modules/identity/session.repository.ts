import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  NewRefreshToken,
  RefreshTokenRecord,
  RefreshTokenRepository,
} from "./session.types.js";

const refreshTokenColumns = {
  id: true,
  userId: true,
  familyId: true,
  tokenHash: true,
  expiresAt: true,
  revokedAt: true,
  replacedById: true,
  createdAt: true,
  createdIp: true,
  userAgent: true,
} satisfies Prisma.RefreshTokenSelect;

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: PrismaClient) {}

  create(token: NewRefreshToken): Promise<RefreshTokenRecord> {
    return this.db.refreshToken.create({ data: token, select: refreshTokenColumns });
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.db.refreshToken.findUnique({ where: { tokenHash }, select: refreshTokenColumns });
  }

  async rotate(
    currentId: string,
    next: NewRefreshToken,
    at: Date,
  ): Promise<RefreshTokenRecord | null> {
    try {
      return await this.db.$transaction(async (tx) => {
        const replacement = await tx.refreshToken.create({
          data: next,
          select: refreshTokenColumns,
        });
        const { count } = await tx.refreshToken.updateMany({
          where: { id: currentId, revokedAt: null },
          data: { revokedAt: at, replacedById: replacement.id },
        });
        if (count === 0) throw new AlreadyRotated();
        return replacement;
      });
    } catch (error) {
      if (error instanceof AlreadyRotated) return null;
      throw error;
    }
  }

  async revokeFamily(familyId: string, at: Date): Promise<number> {
    const { count } = await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
    return count;
  }
}

class AlreadyRotated extends Error {}
