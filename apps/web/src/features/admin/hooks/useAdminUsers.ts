import type { ListUsersQuery } from "@docket/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { userListQuery } from "../api/admin.queries";

export function useAdminUsers(query: ListUsersQuery) {
  return useQuery({ ...userListQuery(query), placeholderData: keepPreviousData });
}
