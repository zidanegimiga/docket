import type { AuditEvent } from "@docket/contracts";
import { describe, expect, it } from "vitest";

import { describeAuditEvent } from "@/features/admin/audit-text";

const base = {
  id: "0199c3a2-0000-7000-8000-000000000001",
  occurredAt: "2026-11-02T10:00:00.000Z",
  actor: null,
  requestId: null,
};
const user = {
  type: "user" as const,
  id: "0199c3a2-0000-7000-8000-000000000002",
  label: "jane@example.com",
};
const role = {
  type: "role" as const,
  id: "0199c3a2-0000-7000-8000-000000000003",
  label: "Helpdesk",
};

describe("describeAuditEvent", () => {
  it.each<[AuditEvent, string]>([
    [
      {
        ...base,
        target: user,
        action: "user.status_changed",
        changes: { from: "pending", to: "active" },
      },
      "Approved jane@example.com",
    ],
    [
      {
        ...base,
        target: user,
        action: "user.status_changed",
        changes: { from: "active", to: "disabled" },
      },
      "Disabled jane@example.com",
    ],
    [
      {
        ...base,
        target: user,
        action: "user.status_changed",
        changes: { from: "disabled", to: "active" },
      },
      "Re-enabled jane@example.com",
    ],
    [
      {
        ...base,
        target: user,
        action: "user.status_changed",
        changes: { from: "active", to: "pending" },
      },
      "Changed jane@example.com from active to waiting for approval",
    ],
    [
      {
        ...base,
        target: user,
        action: "user.roles_changed",
        changes: { added: ["admin"], removed: ["member"] },
      },
      "Roles of jane@example.com: added admin; removed member",
    ],
    [
      {
        ...base,
        target: user,
        action: "user.permissions_changed",
        changes: { added: ["audit:read"], removed: [] },
      },
      "Extra permissions of jane@example.com: added audit:read",
    ],
    [
      { ...base, target: user, action: "user.promoted", changes: {} },
      "Made jane@example.com an administrator",
    ],
    [
      { ...base, target: role, action: "role.created", changes: { permissions: ["tickets:read"] } },
      "Created role Helpdesk with 1 permission",
    ],
    [
      {
        ...base,
        target: role,
        action: "role.updated",
        changes: {
          name: { from: "Support", to: "Helpdesk" },
          description: { from: null, to: "Front line" },
          permissions: { added: ["users:read"], removed: ["tickets:read"] },
        },
      },
      "Changed role Helpdesk: renamed from Support; changed the description; permissions added users:read; removed tickets:read",
    ],
    [
      { ...base, target: role, action: "role.deleted", changes: { permissions: [] } },
      "Deleted role Helpdesk",
    ],
  ])("describes %#", (event, sentence) => {
    expect(describeAuditEvent(event)).toBe(sentence);
  });
});
