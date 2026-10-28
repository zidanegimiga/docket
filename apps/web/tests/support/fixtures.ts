import type {
  AdminUser,
  CurrentUser,
  Pagination,
  Role,
  Ticket,
  TicketList,
} from "@docket/contracts";

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    title: "Printer jammed on floor 2",
    description: null,
    status: "open",
    priority: "medium",
    createdById: null,
    createdAt: "2026-10-15T07:42:00.000Z",
    updatedAt: "2026-10-15T07:42:00.000Z",
    ...overrides,
  };
}

export function makeTicketList(
  tickets: Ticket[],
  pagination: Partial<Pagination> = {},
): TicketList {
  return {
    data: tickets,
    pagination: {
      page: 1,
      limit: 20,
      total: tickets.length,
      totalPages: tickets.length > 0 ? 1 : 0,
      ...pagination,
    },
  };
}

export function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d01",
    email: "ada@example.com",
    name: "Ada Lovelace",
    status: "active",
    permissions: ["tickets:read", "tickets:create", "tickets:update:own", "tickets:update:any"],
    providers: [],
    hasPassword: true,
    ...overrides,
  };
}

export function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "0199c3a2-6f1e-7c3a-9b1d-2f4e6a8c0d02",
    email: "grace@example.com",
    name: "Grace Hopper",
    status: "pending",
    roles: [{ id: MEMBER_ROLE_ID, name: "member" }],
    directPermissions: [],
    effectivePermissions: [],
    providers: [],
    hasPassword: true,
    createdAt: "2026-10-20T09:00:00.000Z",
    lastLoginAt: null,
    ...overrides,
  };
}

export const ADMIN_ROLE_ID = "0199c3a2-0000-7000-8000-00000000000a";
export const MEMBER_ROLE_ID = "0199c3a2-0000-7000-8000-00000000000b";

export function makeRoles(): Role[] {
  return [
    {
      id: ADMIN_ROLE_ID,
      name: "admin",
      description: "Full access",
      permissions: ["users:read", "users:manage"],
      isSystem: true,
      userCount: 1,
    },
    {
      id: MEMBER_ROLE_ID,
      name: "member",
      description: "Works on tickets",
      permissions: ["tickets:read"],
      isSystem: true,
      userCount: 3,
    },
  ];
}
