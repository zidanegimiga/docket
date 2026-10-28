import type { UserStatus } from "@docket/contracts";
import { describe, expect, it } from "vitest";

import type { Principal } from "../../src/core/identity/principal.js";
import { assertAccessChangeAllowed } from "../../src/modules/identity/admin-users.policy.js";
import type {
  AccessChangeSnapshot,
  AdminRole,
} from "../../src/modules/identity/admin-users.types.js";

const adminRole: AdminRole = {
  id: "0199c3a2-0000-7000-8000-00000000000a",
  name: "admin",
  permissions: ["users:read", "users:manage", "roles:manage"],
};
const memberRole: AdminRole = {
  id: "0199c3a2-0000-7000-8000-00000000000b",
  name: "member",
  permissions: ["tickets:read"],
};

const actor: Principal = {
  userId: "0199c3a2-0000-7000-8000-000000000001",
  status: "active",
  permissions: ["users:read", "users:manage"],
};

function snapshot(
  targetId: string,
  before: { status: UserStatus; roles: AdminRole[] },
  after: Partial<AccessChangeSnapshot["after"]>,
  extra: Partial<Pick<AccessChangeSnapshot, "unknownRoleIds" | "otherActiveAdmins">> = {},
): AccessChangeSnapshot {
  return {
    before: { id: targetId, status: before.status, roles: before.roles, directPermissions: [] },
    after: { status: before.status, roles: before.roles, directPermissions: [], ...after },
    unknownRoleIds: [],
    otherActiveAdmins: 1,
    ...extra,
  };
}

const someoneElse = "0199c3a2-0000-7000-8000-000000000002";

describe("assertAccessChangeAllowed", () => {
  it("allows approving a pending member", () => {
    expect(() =>
      assertAccessChangeAllowed(
        actor,
        snapshot(someoneElse, { status: "pending", roles: [memberRole] }, { status: "active" }),
      ),
    ).not.toThrow();
  });

  it("rejects roles that do not exist", () => {
    expect(() =>
      assertAccessChangeAllowed(
        actor,
        snapshot(someoneElse, { status: "active", roles: [] }, {}, { unknownRoleIds: ["x"] }),
      ),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_FAILED" }));
  });

  it.each([
    ["disabling themselves", { status: "disabled" as const }],
    ["removing their own permission to manage users", { roles: [memberRole] }],
  ])("stops administrators %s", (_, after) => {
    expect(() =>
      assertAccessChangeAllowed(
        actor,
        snapshot(actor.userId, { status: "active", roles: [adminRole] }, after),
      ),
    ).toThrow(expect.objectContaining({ statusCode: 409, code: "CANNOT_CHANGE_OWN_ACCESS" }));
  });

  it("lets administrators change their own roles while keeping users:manage", () => {
    expect(() =>
      assertAccessChangeAllowed(
        actor,
        snapshot(
          actor.userId,
          { status: "active", roles: [adminRole] },
          { roles: [adminRole, memberRole] },
        ),
      ),
    ).not.toThrow();
  });

  it.each([
    ["disabled", { status: "disabled" as const }],
    ["stripped of the admin role", { roles: [memberRole] }],
  ])("keeps the last active administrator from being %s", (_, after) => {
    const change = snapshot(someoneElse, { status: "active", roles: [adminRole] }, after, {
      otherActiveAdmins: 0,
    });

    expect(() => assertAccessChangeAllowed(actor, change)).toThrow(
      expect.objectContaining({ statusCode: 409, code: "LAST_ADMIN" }),
    );
  });

  it("allows demoting an administrator while another remains", () => {
    expect(() =>
      assertAccessChangeAllowed(
        actor,
        snapshot(someoneElse, { status: "active", roles: [adminRole] }, { status: "disabled" }),
      ),
    ).not.toThrow();
  });
});
