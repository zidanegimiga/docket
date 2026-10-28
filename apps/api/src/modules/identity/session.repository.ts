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
}
