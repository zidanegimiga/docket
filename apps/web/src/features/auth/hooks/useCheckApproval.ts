import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authKeys } from "../api/auth.queries";
import { refreshCurrentUser } from "../api/auth.api";

/**
 * Asks the API for a fresh session, which carries the user's current status and permissions.
 * The access token only changes on refresh, so this is how a pending user sees an approval.
 */
export function useCheckApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshCurrentUser,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.currentUser(), user);
    },
  });
}
