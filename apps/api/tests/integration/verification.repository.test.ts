import { createHash, randomBytes } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { PrismaVerificationTokenRepository } from "../../src/modules/identity/verification.repository.js";
import { seedUser } from "../helpers/seed-users.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

const randomHash = () => createHash("sha256").update(randomBytes(32)).digest("hex");

describe("PrismaVerificationTokenRepository", () => {
  let container: Container;
  let tokens: PrismaVerificationTokenRepository;
  let userId: string;
  const inADay = () => new Date(Date.now() + 86_400_000);

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
    tokens = new PrismaVerificationTokenRepository(container.database.client);
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
    userId = (await seedUser(container, { email: "jane@example.com" })).id;
  });

  const emailVerifiedAt = async () =>
    (await container.database.client.user.findUniqueOrThrow({ where: { id: userId } }))
      .emailVerifiedAt;

  it("verifies the email and uses up the token", async () => {
    const tokenHash = randomHash();
    await tokens.issueEmailVerification({ userId, tokenHash, expiresAt: inADay() });
    const at = new Date();

    await expect(tokens.verifyEmail(tokenHash, at)).resolves.toEqual({
      status: "verified",
      userId,
    });
    await expect(emailVerifiedAt()).resolves.toEqual(at);
    await expect(
      container.database.client.verificationToken.findUniqueOrThrow({ where: { tokenHash } }),
    ).resolves.toMatchObject({ usedAt: at });
  });

  it("treats a second use as success without moving the verification time", async () => {
    const tokenHash = randomHash();
    await tokens.issueEmailVerification({ userId, tokenHash, expiresAt: inADay() });
    const first = new Date();
    await tokens.verifyEmail(tokenHash, first);

    await expect(tokens.verifyEmail(tokenHash, new Date(first.getTime() + 1000))).resolves.toEqual({
      status: "verified",
      userId,
    });
    await expect(emailVerifiedAt()).resolves.toEqual(first);
  });

  it("rejects unknown and expired tokens without verifying anything", async () => {
    const tokenHash = randomHash();
    await tokens.issueEmailVerification({ userId, tokenHash, expiresAt: inADay() });

    await expect(tokens.verifyEmail(randomHash(), new Date())).resolves.toEqual({
      status: "invalid",
    });
    await expect(
      tokens.verifyEmail(tokenHash, new Date(Date.now() + 2 * 86_400_000)),
    ).resolves.toEqual({ status: "expired" });
    await expect(emailVerifiedAt()).resolves.toBeNull();
  });

  it("invalidates earlier links when a new one is issued", async () => {
    const older = randomHash();
    const newer = randomHash();
    await tokens.issueEmailVerification({ userId, tokenHash: older, expiresAt: inADay() });
    await tokens.issueEmailVerification({ userId, tokenHash: newer, expiresAt: inADay() });

    await expect(tokens.verifyEmail(older, new Date())).resolves.toEqual({ status: "invalid" });
    await expect(tokens.verifyEmail(newer, new Date())).resolves.toMatchObject({
      status: "verified",
    });
  });

  it("refuses to store anything but a SHA-256 hash", async () => {
    await expect(
      tokens.issueEmailVerification({ userId, tokenHash: "x".repeat(64), expiresAt: inADay() }),
    ).rejects.toThrow();
  });
});
