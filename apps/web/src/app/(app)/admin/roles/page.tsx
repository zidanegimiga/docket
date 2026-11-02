import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { roleListQuery } from "@/features/admin/api/admin.queries";
import { AdminRoles } from "@/features/admin/components/AdminRoles";
import { RequirePermission } from "@/features/auth/components/RequirePermission";
import { serverRequestContext } from "@/features/auth/server-session";
import { getQueryClient } from "@/shared/query/query-client";

import styles from "../admin-page.module.css";

export const metadata: Metadata = { title: "Roles · Docket" };

export default async function RolesPage() {
  const context = await serverRequestContext();
  const queryClient = getQueryClient();
  if (context) await queryClient.prefetchQuery(roleListQuery(context));

  return (
    <section className={styles.page} aria-labelledby="roles-heading">
      <h1 id="roles-heading">Roles</h1>
      <RequirePermission
        permission="users:read"
        fallback={<p className={styles.denied}>You do not have access to roles.</p>}
      >
        <HydrationBoundary state={dehydrate(queryClient)}>
          <AdminRoles />
        </HydrationBoundary>
      </RequirePermission>
    </section>
  );
}
