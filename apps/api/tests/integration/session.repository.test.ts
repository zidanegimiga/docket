import { randomBytes, randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { hashRefreshToken } from "../../src/modules/identity/auth.service.js";
import { PrismaRefreshTokenRepository } from "../../src/modules/identity/session.repository.js";
import type { NewRefreshToken } from "../../src/modules/identity/session.types.js";
import { seedUser } from "../helpers/seed-users.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("PrismaRefreshTokenRepository", () => {
  let container: Container;
  let tokens: PrismaRefreshTokenRepository;
  let userId: string;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
    tokens = new PrismaRefreshTokenRepository(container.database.client);
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
    userId = (await seedUser(container, { email: "jane@example.com" })).id;
  });

  const newToken = (familyId: string): NewRefreshToken => ({
    userId,
    familyId,
    tokenHash: hashRefreshToken(randomBytes(32).toString("base64url")),
    expiresAt: new Date(Date.now() + 86_400_000),
    createdIp: null,
    userAgent: null,
  });

  it("rotates a token by revoking it and linking its replacement", async () => {
    const familyId = randomUUID();
    const current = await tokens.create(newToken(familyId));

    const replacement = await tokens.rotate(current.id, newToken(familyId), new Date());

    const stored = await tokens.findByHash(current.tokenHash);
    expect(stored).toMatchObject({ replacedById: replacement!.id, revokedAt: expect.any(Date) });
    expect(replacement).toMatchObject({ familyId, revokedAt: null });
  });

  it("lets only one of two simultaneous rotations win, leaving no orphan replacement", async () => {
    const familyId = randomUUID();
    const current = await tokens.create(newToken(familyId));

    const results = await Promise.all([
      tokens.rotate(current.id, newToken(familyId), new Date()),
      tokens.rotate(current.id, newToken(familyId), new Date()),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(container.database.client.refreshToken.count()).resolves.toBe(2);
  });

  it("refuses to rotate a token that was already revoked", async () => {
    const familyId = randomUUID();
    const current = await tokens.create(newToken(familyId));
    await tokens.revokeFamily(familyId, new Date());

    await expect(tokens.rotate(current.id, newToken(familyId), new Date())).resolves.toBeNull();
    await expect(container.database.client.refreshToken.count()).resolves.toBe(1);
  });

  it("revokes every active token in a family and nothing in other families", async () => {
    const family = randomUUID();
    const otherFamily = randomUUID();
    await tokens.create(newToken(family));
    await tokens.create(newToken(family));
    const other = await tokens.create(newToken(otherFamily));

    await expect(tokens.revokeFamily(family, new Date())).resolves.toBe(2);
    await expect(tokens.revokeFamily(family, new Date())).resolves.toBe(0);
    await expect(tokens.findByHash(other.tokenHash)).resolves.toMatchObject({ revokedAt: null });
  });
});
