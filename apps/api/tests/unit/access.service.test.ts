import type { UserStatus } from "@docket/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { AccessService } from "../../src/modules/identity/access.service.js";
import { InMemoryUserRepository } from "../helpers/in-memory-user.repository.js";
import { RecordingLogger } from "../helpers/recording.logger.js";

describe("AccessService.resolve", () => {
  let users: InMemoryUserRepository;
  let logger: RecordingLogger;
  let service: AccessService;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    logger = new RecordingLogger();
    service = new AccessService(users, logger);
  });

  const userWithStatus = async (status: UserStatus) => {
    const user = await users.createWithPassword({
      email: `${status}@example.com`,
      name: "U",
      passwordHash: "h",
    });
    user!.status = status;
    return user!;
  };

  it("combines role and direct permissions for an active user, without duplicates, in catalog order", async () => {
    const user = await userWithStatus("active");
    users.grant(user.id, {
      rolePermissions: ["tickets:update:own", "tickets:read", "tickets:create"],
      directPermissions: ["audit:read", "tickets:read"],
    });

    await expect(service.resolve(user.id)).resolves.toEqual({
      userId: user.id,
      status: "active",
      permissions: ["tickets:read", "tickets:create", "tickets:update:own", "audit:read"],
    });
  });

  it.each(["pending", "disabled"] as const)(
    "gives a %s user no permissions, whatever their roles grant",
    async (status) => {
      const user = await userWithStatus(status);
      users.grant(user.id, { rolePermissions: ["users:manage", "roles:manage"] });

      await expect(service.resolve(user.id)).resolves.toEqual({
        userId: user.id,
        status,
        permissions: [],
      });
    },
  );

  it("drops stored permissions that are no longer in the catalog and warns about them", async () => {
    const user = await userWithStatus("active");
    users.grant(user.id, { rolePermissions: ["tickets:read", "tickets:export"] });

    const access = await service.resolve(user.id);

    expect(access?.permissions).toEqual(["tickets:read"]);
    expect(logger.entries).toEqual([
      {
        level: "warn",
        message: "Ignoring stored permissions that are not in the catalog",
        context: { userId: user.id, unknown: ["tickets:export"] },
      },
    ]);
  });

  it("returns null for a user that does not exist", async () => {
    await expect(service.resolve("0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d99")).resolves.toBeNull();
  });
});
