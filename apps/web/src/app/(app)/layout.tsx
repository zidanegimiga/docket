import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { currentUserQuery } from "@/features/auth/api/auth.queries";
import { SessionGate } from "@/features/auth/components/SessionGate";
import { serverRequestContext } from "@/features/auth/server-session";
import { getQueryClient } from "@/shared/query/query-client";

import styles from "../layout.module.css";

interface AppLayoutProps {
  children: ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const context = await serverRequestContext();
  const queryClient = getQueryClient();
  // Without a live access token the browser refreshes the session and loads the user itself.
  if (context) await queryClient.prefetchQuery(currentUserQuery(context));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SessionGate mainClassName={styles.main}>{children}</SessionGate>
    </HydrationBoundary>
  );
}
