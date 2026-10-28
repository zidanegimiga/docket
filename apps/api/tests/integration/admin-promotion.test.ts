import type { UserStatus } from "@docket/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { AccessService } from "../../src/modules/identity/access.service.js";
import { promoteToAdmin } from "../../src/modules/identity/admin-promotion.js";
import { PrismaUserRepository } from "../../src/modules/identity/user.repository.js";
import { RecordingLogger } from "../helpers/recording.logger.js";
import { seedUser } from "../helpers/seed-users.js";
import { createTestContainer, resetDatabase } from "../helpers/test-app.js";

describe("promoteToAdmin", () => {
  let container: Container;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
  });

  const access = (userId: string) =>
    container.database.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true, roles: { select: { role: { select: { name: true } } } } },
    });

  it.each<UserStatus>(["pending", "disabled"])(
    "activates a %s account and gives it the admin role, keeping its other roles",
    async (status) => {
      const user = await seedUser(container, {
        email: "jane@example.com",
        status,
        roles: ["member"],
      });

      const result = await promoteToAdmin(container.database.client, "jane@example.com");

      expect(result).toEqual({
        promoted: true,
        userId: user.id,
        previousStatus: status,
        alreadyAdmin: false,
      });
      const stored = await access(user.id);
      expect(stored.status).toBe("active");
      expect(stored.roles.map(({ role }) => role.name).sort()).toEqual(["admin", "member"]);
    },
  );

  it("is safe to run twice", async () => {
    const user = await seedUser(container, { email: "jane@example.com" });
    await promoteToAdmin(container.database.client, "jane@example.com");

    const again = await promoteToAdmin(container.database.client, "jane@example.com");

    expect(again).toMatchObject({ promoted: true, alreadyAdmin: true, previousStatus: "active" });
    await expect(
      container.database.client.userRole.count({ where: { userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("creates nothing for an unknown email", async () => {
    await expect(promoteToAdmin(container.database.client, "nobody@example.com")).resolves.toEqual({
      promoted: false,
      reason: "user_not_found",
    });
    await expect(container.database.client.user.count()).resolves.toBe(0);
  });

  it("gives the promoted user every permission at their next refresh", async () => {
    const user = await seedUser(container, { email: "jane@example.com", status: "pending" });
    const accessService = new AccessService(
      new PrismaUserRepository(container.database.client),
      new RecordingLogger(),
    );
    await promoteToAdmin(container.database.client, "jane@example.com");

    const resolved = await accessService.resolve(user.id);

    expect(resolved?.permissions).toEqual(
      expect.arrayContaining(["users:manage", "roles:manage", "tickets:update:any"]),
    );
  });
});
