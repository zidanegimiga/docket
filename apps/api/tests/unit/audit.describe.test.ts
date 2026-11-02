import { describe, expect, it } from "vitest";

import { describeRoleUpdated } from "../../src/modules/identity/admin-roles.audit.js";
import type { AdminRoleRecord } from "../../src/modules/identity/admin-roles.types.js";
import { describeAccessChange } from "../../src/modules/identity/admin-users.audit.js";
import type { AccessChangeSnapshot } from "../../src/modules/identity/admin-users.types.js";

const context = { actorId: "0199c3a2-0000-7000-8000-000000000001", requestId: "req-1" };
const member = { id: "r-member", name: "member", permissions: ["tickets:read"] };
const admin = { id: "r-admin", name: "admin", permissions: ["users:manage"] };

const snapshot = (after: Partial<AccessChangeSnapshot["after"]>): AccessChangeSnapshot => ({
  before: {
    id: "0199c3a2-0000-7000-8000-000000000002",
    email: "jane@example.com",
    status: "pending",
    roles: [member],
    directPermissions: ["audit:read"],
  },
  after: { status: "pending", roles: [member], directPermissions: ["audit:read"], ...after },
  unknownRoleIds: [],
  otherActiveAdmins: 1,
});

describe("describeAccessChange", () => {
  it("records nothing when a save changes nothing", () => {
    expect(describeAccessChange(snapshot({}), context)).toEqual([]);
  });

  it("records each kind of change separately, labelled with the user's email", () => {
    const events = describeAccessChange(
      snapshot({ status: "active", roles: [admin], directPermissions: [] }),
      context,
    );

    expect(events).toEqual([
      expect.objectContaining({
        action: "user.status_changed",
        changes: { from: "pending", to: "active" },
        targetLabel: "jane@example.com",
        ...context,
      }),
      expect.objectContaining({
        action: "user.roles_changed",
        changes: { added: ["admin"], removed: ["member"] },
      }),
      expect.objectContaining({
        action: "user.permissions_changed",
        changes: { added: [], removed: ["audit:read"] },
      }),
    ]);
  });
});

describe("describeRoleUpdated", () => {
  const role: AdminRoleRecord = {
    id: "0199c3a2-0000-7000-8000-00000000000c",
    name: "Support",
    description: null,
    isSystem: false,
    permissions: ["tickets:read"],
    userCount: 0,
  };

  it("returns nothing when the change leaves the role as it was", () => {
    expect(
      describeRoleUpdated(role, { name: "Support", permissions: ["tickets:read"] }, context),
    ).toBeNull();
  });

  it("records only what changed, under the role's new name", () => {
    expect(
      describeRoleUpdated(
        role,
        { name: "Helpdesk", description: null, permissions: ["tickets:read", "users:read"] },
        context,
      ),
    ).toMatchObject({
      action: "role.updated",
      targetLabel: "Helpdesk",
      changes: {
        name: { from: "Support", to: "Helpdesk" },
        permissions: { added: ["users:read"], removed: [] },
      },
    });
  });
});
