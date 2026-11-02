"use client";

import { AUDIT_ACTIONS, type AuditAction } from "@docket/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import type { ChangeEvent } from "react";

import { Button } from "@/shared/components/Button";
import { Pagination } from "@/shared/components/Pagination";
import { Select } from "@/shared/components/Select";

import { auditHref, parseAuditQuery } from "../../audit-query";
import { auditActionLabels } from "../../audit-text";
import { useAuditLog } from "../../hooks/useAuditLog";
import { AuditTable } from "../AuditTable";
import styles from "../list-layout.module.css";

const actionOptions = [
  { value: "", label: "All changes" },
  ...AUDIT_ACTIONS.map((action) => ({ value: action, label: auditActionLabels[action] })),
];

export function AuditLog() {
  const router = useRouter();
  const query = parseAuditQuery(Object.fromEntries(useSearchParams()));
  const { data, isPending, isError, isPlaceholderData, refetch } = useAuditLog(query);

  const handleAction = (event: ChangeEvent<HTMLSelectElement>) => {
    const action = (event.target.value || undefined) as AuditAction | undefined;
    router.replace(auditHref({ ...query, action, page: 1 }), { scroll: false });
  };

  return (
    <div className={styles.list}>
      <div className={styles.toolbar}>
        <p className={styles.message}>
          Every change to users and roles, newest first. Entries cannot be edited or deleted.
        </p>
        <div>
          <Select
            name="action"
            label="Show"
            value={query.action ?? ""}
            options={actionOptions}
            onChange={handleAction}
          />
        </div>
      </div>

      {isPending && <p className={styles.message}>Loading the audit log…</p>}
      {isError && !data && (
        <div className={styles.message} role="alert">
          <p>The audit log could not be loaded.</p>
          <Button onClick={() => void refetch()}>Try again</Button>
        </div>
      )}
      {data && (
        <>
          <AuditTable
            events={data.data}
            emptyMessage={
              query.action ? "No changes of this kind yet." : "No changes recorded yet."
            }
            stale={isPlaceholderData}
          />
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            hrefFor={(page) => auditHref({ ...query, page })}
          />
        </>
      )}
    </div>
  );
}
