import { randomBytes, randomUUID, createHash } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { PrismaTokenCleanupRepository } from "../../src/modules/identity/token-cleanup.repository.js";
import { seedUser } from "../helpers/seed-users.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

const hash = () => createHash("sha256").update(randomBytes(16)).digest("hex");
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

describe("expired token cleanup", () => {
  let container: Container;
  let userId: string;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
    userId = (await seedUser(container, { email: "jane@example.com" })).id;
  });

  const refreshToken = (expiresAt: Date, extra: object = {}) => ({
    userId,
    familyId: randomUUID(),
    tokenHash: hash(),
    createdAt: new Date(expiresAt.getTime() - 30 * 86_400_000),
    expiresAt,
    ...extra,
  });

  it("deletes only refresh tokens past the cutoff, in batches however many there are", async () => {
    const db = container.database.client;
    await db.refreshToken.createMany({
      data: Array.from({ length: 2_500 }, () => refreshToken(daysAgo(3))),
    });
    const live = await db.refreshToken.create({ data: refreshToken(daysAgo(-10)) });
    const recentlyExpired = await db.refreshToken.create({ data: refreshToken(daysAgo(0.5)) });

    const deleted = await new PrismaTokenCleanupRepository(db).deleteRefreshTokensExpiredBefore(
      daysAgo(1),
    );

    expect(deleted).toBe(2_500);
    expect(
      (await db.refreshToken.findMany({ select: { id: true } })).map((t) => t.id).sort(),
    ).toEqual([live.id, recentlyExpired.id].sort());
  });

  it("keeps a live token whose rotated predecessor is deleted", async () => {
    const db = container.database.client;
    const familyId = randomUUID();
    const current = await db.refreshToken.create({
      data: refreshToken(daysAgo(-10), { familyId }),
    });
    await db.refreshToken.create({
      data: refreshToken(daysAgo(3), { familyId, revokedAt: daysAgo(4), replacedById: current.id }),
    });

    await new PrismaTokenCleanupRepository(db).deleteRefreshTokensExpiredBefore(daysAgo(1));

    await expect(db.refreshToken.findMany({ where: { familyId } })).resolves.toEqual([
      expect.objectContaining({ id: current.id, revokedAt: null }),
    ]);
  });

  it("deletes expired verification tokens, used or not, and keeps live ones", async () => {
    const db = container.database.client;
    const token = (expiresAt: Date, usedAt: Date | null = null) => ({
      userId,
      purpose: "email_verification" as const,
      tokenHash: hash(),
      createdAt: new Date(expiresAt.getTime() - 86_400_000),
      expiresAt,
      usedAt,
    });
    await db.verificationToken.createMany({
      data: [token(daysAgo(2)), token(daysAgo(2), daysAgo(2.5)), token(daysAgo(-1))],
    });

    const deleted = await new PrismaTokenCleanupRepository(
      db,
    ).deleteVerificationTokensExpiredBefore(daysAgo(1));

    expect(deleted).toBe(2);
    await expect(db.verificationToken.count()).resolves.toBe(1);
  });

  it("runs end to end through the identity jobs with the one-day grace", async () => {
    const db = container.database.client;
    await db.refreshToken.createMany({
      data: [refreshToken(daysAgo(2)), refreshToken(daysAgo(0.5))],
    });

    await expect(container.jobs.cleanupTokens()).resolves.toEqual({
      refreshTokens: 1,
      verificationTokens: 0,
    });
    await expect(db.refreshToken.count()).resolves.toBe(1);
  });
});
