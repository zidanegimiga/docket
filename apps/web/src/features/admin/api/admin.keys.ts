import type { ListUsersQuery } from "@docket/contracts";

export const adminKeys = {
  all: ["admin"] as const,
  users: () => [...adminKeys.all, "users"] as const,
  userList: (query: ListUsersQuery) => [...adminKeys.users(), query] as const,
  roles: () => [...adminKeys.all, "roles"] as const,
};
