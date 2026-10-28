import { PERMISSIONS } from "@docket/contracts";
import { describe, expect, it } from "vitest";

import {
  assertRoleDeletable,
  assertRoleUpdateAllowed,
} from "../../src/modules/identity/admin-roles.policy.js";
import type { AdminRoleRecord } from "../../src/modules/identity/admin-roles.types.js";

const role = (overrides: Partial<AdminRoleRecord>): AdminRoleRecord => ({
  id: "0199c3a2-0000-7000-8000-00000000000c",
  name: "support",
  description: null,
  isSystem: false,
  permissions: ["tickets:read"],
  userCount: 0,
  ...overrides,
});

const admin = role({ name: "admin", isSystem: true, permissions: [...PERMISSIONS] });
const member = role({ name: "member", isSystem: true });

describe("role rules", () => {
  it("lets custom roles change freely", () => {
    expect(() =>
      assertRoleUpdateAllowed(role({}), { name: "helpdesk", permissions: ["users:read"] }),
    ).not.toThrow();
  });

  it.each([
    ["admin", admin],
    ["member", member],
  ])("refuses to rename the built-in %s role", (_, systemRole) => {
    expect(() => assertRoleUpdateAllowed(systemRole, { name: "renamed" })).toThrow(
      expect.objectContaining({ statusCode: 409, code: "SYSTEM_ROLE" }),
    );
    expect(() => assertRoleUpdateAllowed(systemRole, { name: systemRole.name })).not.toThrow();
  });

  it("keeps every permission on admin but lets member's permissions change", () => {
    expect(() =>
      assertRoleUpdateAllowed(admin, { permissions: ["users:manage", "roles:manage"] }),
    ).toThrow(expect.objectContaining({ code: "SYSTEM_ROLE" }));
    expect(() => assertRoleUpdateAllowed(admin, { permissions: [...PERMISSIONS] })).not.toThrow();
    expect(() => assertRoleUpdateAllowed(admin, { description: "Everything" })).not.toThrow();
    expect(() => assertRoleUpdateAllowed(member, { permissions: [] })).not.toThrow();
  });

  it("only deletes custom roles that nobody holds", () => {
    expect(() => assertRoleDeletable(role({}))).not.toThrow();
    expect(() => assertRoleDeletable(member)).toThrow(
      expect.objectContaining({ code: "SYSTEM_ROLE" }),
    );
    expect(() => assertRoleDeletable(role({ userCount: 2 }))).toThrow(
      expect.objectContaining({
        code: "ROLE_IN_USE",
        message: expect.stringContaining("2 people"),
      }),
    );
  });
});
