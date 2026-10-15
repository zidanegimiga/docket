"use client";

import type { ListTicketsQuery } from "@docket/contracts";
import { useSearchParams } from "next/navigation";

import { Button } from "@/shared/components/Button";
import { Pagination } from "@/shared/components/Pagination";

import { useTickets } from "../../hooks/useTickets";
import { statusLabels } from "../../labels";
import { listHref, parseListQuery } from "../../list-query";
import { StatusFilter } from "../StatusFilter";
import { TicketTable } from "../TicketTable";
import styles from "./TicketList.module.css";

function emptyMessage({ status }: ListTicketsQuery, total: number): string {
  if (total > 0) return "No tickets on this page.";
  if (status) return `No ${statusLabels[status].toLowerCase()} tickets.`;
  return "No tickets yet. Use the form to log the first one.";
}

export function TicketList() {
  const searchParams = useSearchParams();
  const query = parseListQuery(Object.fromEntries(searchParams));
  const { data, isPending, isError, isPlaceholderData, refetch } = useTickets(query);

  return (
    <div className={styles.list}>
      <div className={styles.toolbar}>
        <StatusFilter current={query.status} limit={query.limit} />
        {data && (
          <p className={styles.count}>
            {data.pagination.total} {data.pagination.total === 1 ? "ticket" : "tickets"}
          </p>
        )}
      </div>

      {isPending && <p className={styles.message}>Loading tickets…</p>}

      {isError && !data && (
        <div className={styles.message} role="alert">
          <p>Tickets could not be loaded.</p>
          <Button onClick={() => void refetch()}>Try again</Button>
        </div>
      )}

      {data && (
        <>
          <TicketTable
            tickets={data.data}
            emptyMessage={emptyMessage(query, data.pagination.total)}
            stale={isPlaceholderData}
          />
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            hrefFor={(page) => listHref({ ...query, page })}
          />
        </>
      )}
    </div>
  );
}
