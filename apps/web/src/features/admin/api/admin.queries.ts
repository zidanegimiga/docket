import type { ListUsersQuery } from "@docket/contracts";
import { queryOptions } from "@tanstack/react-query";

import type { RequestContext } from "@/shared/api/http-client";

import { listRoles, listUsers } from "./admin.api";
import { adminKeys } from "./admin.keys";

export function userListQuery(query: ListUsersQuery, context?: RequestContext) {
  return queryOptions({
    queryKey: adminKeys.userList(query),
    queryFn: ({ signal }) => listUsers(query, signal, context),
  });
}

export function roleListQuery(context?: RequestContext) {
  return queryOptions({
    queryKey: adminKeys.roles(),
    queryFn: ({ signal }) => listRoles(signal, context),
    staleTime: 5 * 60_000,
  });
}
