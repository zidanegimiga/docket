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
  /** Revokes the current token and stores its replacement atomically. Null if it was already revoked. */
  rotate(currentId: string, next: NewRefreshToken, at: Date): Promise<RefreshTokenRecord | null>;
  /** Revokes every still-active token in the family and returns how many were revoked. */
  revokeFamily(familyId: string, at: Date): Promise<number>;
}
