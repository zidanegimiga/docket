import { PERMISSIONS } from "@docket/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { createTestContainer } from "../helpers/test-app.js";

describe("system roles", () => {
  let container: Container;

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  const permissionsOf = async (name: string) => {
    const role = await container.database.client.role.findUniqueOrThrow({
      where: { name },
      include: { permissions: true },
    });
    return { isSystem: role.isSystem, permissions: role.permissions.map((p) => p.permission) };
  };

  it("grants admin every permission in the catalog", async () => {
    const admin = await permissionsOf("admin");

    expect(admin.isSystem).toBe(true);
    expect(admin.permissions.sort()).toEqual([...PERMISSIONS].sort());
  });

  it("limits member to working on tickets", async () => {
    const member = await permissionsOf("member");

    expect(member.isSystem).toBe(true);
    expect(member.permissions.sort()).toEqual(
      ["tickets:create", "tickets:read", "tickets:update:own"].sort(),
    );
  });

  it("only references permissions that exist in the catalog", async () => {
    const stored = await container.database.client.rolePermission.findMany({
      select: { permission: true },
      distinct: ["permission"],
    });

    for (const { permission } of stored) {
      expect(PERMISSIONS).toContain(permission);
    }
  });
});
