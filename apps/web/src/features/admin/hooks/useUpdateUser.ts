import type { UpdateUserInput } from "@docket/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateUser } from "../api/admin.api";
import { adminKeys } from "../api/admin.keys";

export interface UpdateUserVariables {
  id: string;
  change: UpdateUserInput;
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, change }: UpdateUserVariables) => updateUser(id, change),
    // Statuses move users between filters and role counts change, so refresh everything admin.
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  });
}
