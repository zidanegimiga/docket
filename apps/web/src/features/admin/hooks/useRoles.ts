import { useQuery } from "@tanstack/react-query";

import { roleListQuery } from "../api/admin.queries";

export function useRoles() {
  return useQuery(roleListQuery());
}
