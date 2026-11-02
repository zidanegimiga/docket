import type { CreateRoleInput, UpdateRoleInput } from "@docket/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createRole, deleteRole, updateRole } from "../api/admin.api";
import { adminKeys } from "../api/admin.keys";

/**
 * Creating, changing and deleting roles. Each refreshes everything under the admin key, because a
 * role change alters the effective permissions shown on the users page too.
 */
export function useRoleMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.all });

  return {
    create: useMutation({
      mutationFn: (input: CreateRoleInput) => createRole(input),
      onSettled: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, change }: { id: string; change: UpdateRoleInput }) =>
        updateRole(id, change),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteRole(id),
      onSettled: refresh,
    }),
  };
}
