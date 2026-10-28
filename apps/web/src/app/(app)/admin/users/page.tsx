import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { roleListQuery, userListQuery } from "@/features/admin/api/admin.queries";
import { AdminUsers } from "@/features/admin/components/AdminUsers";
import { parseUserListView } from "@/features/admin/user-query";
import { RequirePermission } from "@/features/auth/components/RequirePermission";
import { serverRequestContext } from "@/features/auth/server-session";
import { getQueryClient } from "@/shared/query/query-client";

import styles from "./page.module.css";

export const metadata: Metadata = { title: "Users · Docket" };

interface UsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const { selected: _selected, ...query } = parseUserListView(await searchParams);
  const context = await serverRequestContext();
  const queryClient = getQueryClient();

  if (context) {
    // Both fail with 403 for users without users:read; failed queries are simply not sent along.
    await Promise.all([
      queryClient.prefetchQuery(userListQuery(query, context)),
      queryClient.prefetchQuery(roleListQuery(context)),
    ]);
  }

  return (
    <section className={styles.page} aria-labelledby="users-heading">
      <h1 id="users-heading">Users</h1>
      <RequirePermission
        permission="users:read"
        fallback={<p className={styles.denied}>You do not have access to manage users.</p>}
      >
        <HydrationBoundary state={dehydrate(queryClient)}>
          <AdminUsers />
        </HydrationBoundary>
      </RequirePermission>
    </section>
  );
}
