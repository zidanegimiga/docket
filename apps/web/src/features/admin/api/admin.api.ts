import {
  adminUserSchema,
  roleListSchema,
  userListSchema,
  type AdminUser,
  type ListUsersQuery,
  type RoleList,
  type UpdateUserInput,
  type UserList,
} from "@docket/contracts";

import { request, type RequestContext } from "@/shared/api/http-client";

export async function listUsers(
  { status, search, page, limit }: ListUsersQuery,
  signal?: AbortSignal,
  context: RequestContext = {},
): Promise<UserList> {
  const data = await request<unknown>("/admin/users", {
    ...context,
    query: { status, search, page, limit },
    ...(signal && { signal }),
  });
  return userListSchema.parse(data);
}

export async function updateUser(id: string, change: UpdateUserInput): Promise<AdminUser> {
  const data = await request<unknown>(`/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: change,
  });
  return adminUserSchema.parse(data);
}

export async function listRoles(
  signal?: AbortSignal,
  context: RequestContext = {},
): Promise<RoleList> {
  const data = await request<unknown>("/admin/roles", { ...context, ...(signal && { signal }) });
  return roleListSchema.parse(data);
}
