import { useQuery } from "@tanstack/react-query";

import { currentUserQuery } from "../api/auth.queries";

export function useCurrentUser() {
  return useQuery(currentUserQuery());
}
