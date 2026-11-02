import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { auditLogQuery } from "@/features/admin/api/admin.queries";
import { parseAuditQuery } from "@/features/admin/audit-query";
import { AuditLog } from "@/features/admin/components/AuditLog";
import { RequirePermission } from "@/features/auth/components/RequirePermission";
import { serverRequestContext } from "@/features/auth/server-session";
import { getQueryClient } from "@/shared/query/query-client";

import styles from "../admin-page.module.css";

export const metadata: Metadata = { title: "Audit log · Docket" };

interface AuditPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const query = parseAuditQuery(await searchParams);
  const context = await serverRequestContext();
  const queryClient = getQueryClient();
  if (context) await queryClient.prefetchQuery(auditLogQuery(query, context));

  return (
    <section className={styles.page} aria-labelledby="audit-heading">
      <h1 id="audit-heading">Audit log</h1>
      <RequirePermission
        permission="audit:read"
        fallback={<p className={styles.denied}>You do not have access to the audit log.</p>}
      >
        <HydrationBoundary state={dehydrate(queryClient)}>
          <AuditLog />
        </HydrationBoundary>
      </RequirePermission>
    </section>
  );
}
