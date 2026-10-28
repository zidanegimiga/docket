import { queryOptions } from "@tanstack/react-query";

import type { RequestContext } from "@/shared/api/http-client";

import { getCurrentUser } from "./auth.api";

export const authKeys = {
  currentUser: () => ["auth", "current-user"] as const,
};

export function currentUserQuery(context?: RequestContext) {
  return queryOptions({
    queryKey: authKeys.currentUser(),
    queryFn: ({ signal }) => getCurrentUser(context, signal),
    staleTime: 5 * 60_000,
  });
}
