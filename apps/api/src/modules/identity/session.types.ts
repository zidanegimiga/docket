export interface NewRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  createdIp: string | null;
  userAgent: string | null;
}

export interface RefreshTokenRecord extends NewRefreshToken {
  id: string;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
}

export interface RefreshTokenRepository {
  create(token: NewRefreshToken): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
}
