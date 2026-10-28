import { useMutation, useQueryClient } from "@tanstack/react-query";

import { logOut } from "../api/auth.api";

export function useLogOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logOut,
    // Even if the request fails the user asked to leave: drop everything and go to login.
    onSettled: () => {
      queryClient.clear();
      window.location.assign("/login");
    },
  });
}
