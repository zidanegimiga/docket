import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authKeys } from "../api/auth.queries";
import { logIn } from "../api/auth.api";

export function useLogIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logIn,
    onSuccess: (user) => {
      // Anything cached belonged to whoever was signed in before.
      queryClient.clear();
      queryClient.setQueryData(authKeys.currentUser(), user);
    },
  });
}
