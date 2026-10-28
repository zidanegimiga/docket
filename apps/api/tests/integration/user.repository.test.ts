import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { PrismaUserRepository } from "../../src/modules/identity/user.repository.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("PrismaUserRepository", () => {
  let container: Container;
  let users: PrismaUserRepository;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
    users = new PrismaUserRepository(container.database.client);
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
  });

  const google = { provider: "google", subject: "google-123", email: "jane@example.com" };

  const roleNames = async (userId: string) =>
    (
      await container.database.client.userRole.findMany({
        where: { userId },
        select: { role: { select: { name: true } } },
      })
    ).map(({ role }) => role.name);

  it("creates a pending password user and finds it by email and id", async () => {
    const created = await users.createWithPassword({
      email: "jane@example.com",
      name: "Jane",
      passwordHash: "$argon2id$hash",
    });

    expect(created).toMatchObject({ status: "pending", emailVerifiedAt: null, lastLoginAt: null });
    expect(created?.id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(users.findByEmail("jane@example.com")).resolves.toEqual(created);
    await expect(users.findById(created!.id)).resolves.toEqual(created);
    // Pending withholds the member role's permissions until an administrator approves.
    await expect(roleNames(created!.id)).resolves.toEqual(["member"]);
  });

  it("returns null instead of throwing when the email is already registered", async () => {
    const first = { email: "jane@example.com", name: "Jane", passwordHash: "h" };
    await users.createWithPassword(first);

    await expect(users.createWithPassword(first)).resolves.toBeNull();
    await expect(
      users.createWithIdentity({
        email: first.email,
        name: "Jane",
        emailVerified: true,
        identity: google,
      }),
    ).resolves.toBeNull();
  });

  it("creates an external user with a verified email and finds it by identity", async () => {
    const created = await users.createWithIdentity({
      email: "jane@example.com",
      name: "Jane",
      emailVerified: true,
      identity: google,
    });

    expect(created).toMatchObject({ passwordHash: null, status: "pending" });
    expect(created?.emailVerifiedAt).toBeInstanceOf(Date);
    await expect(users.findByIdentity("google", "google-123")).resolves.toEqual(created);
    await expect(users.findByIdentity("google", "someone-else")).resolves.toBeNull();
    await expect(users.listProviders(created!.id)).resolves.toEqual(["google"]);
    await expect(roleNames(created!.id)).resolves.toEqual(["member"]);
  });

  it("links another identity to an existing user", async () => {
    const user = await users.createWithPassword({
      email: "jane@example.com",
      name: "Jane",
      passwordHash: "h",
    });

    await users.linkIdentity(user!.id, google);

    await expect(users.findByIdentity("google", "google-123")).resolves.toMatchObject({
      id: user!.id,
    });
  });

  it("reports status, role permissions and direct grants without deciding what they add up to", async () => {
    const user = await users.createWithPassword({
      email: "jane@example.com",
      name: "Jane",
      passwordHash: "h",
    });
    await container.database.client.userPermission.create({
      data: { userId: user!.id, permission: "audit:read" },
    });

    const access = await users.findAccess(user!.id);

    expect(access?.status).toBe("pending");
    expect(access?.rolePermissions.sort()).toEqual([
      "tickets:create",
      "tickets:read",
      "tickets:update:own",
    ]);
    expect(access?.directPermissions).toEqual(["audit:read"]);
    await expect(users.findAccess("0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d99")).resolves.toBeNull();
  });

  it("records the last login and replaces the password hash", async () => {
    const user = await users.createWithPassword({
      email: "jane@example.com",
      name: "Jane",
      passwordHash: "old",
    });
    const at = new Date("2026-10-28T09:00:00.000Z");

    await users.recordLogin(user!.id, at);
    await users.updatePasswordHash(user!.id, "new");

    await expect(users.findById(user!.id)).resolves.toMatchObject({
      lastLoginAt: at,
      passwordHash: "new",
    });
  });

  it("keeps the system roles when the test database is reset", async () => {
    const roles = await container.database.client.role.findMany({ select: { name: true } });

    expect(roles.map((role) => role.name).sort()).toEqual(["admin", "member"]);
  });
});
