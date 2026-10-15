import { TICKET_STATUSES, type TicketStats, type TicketStatus } from "@docket/contracts";
import Link from "next/link";

import { listHref } from "../../list-query";
import { statusLabels } from "../../labels";
import styles from "./StatusFilter.module.css";

interface StatusFilterProps {
  current: TicketStatus | undefined;
  limit: number;
  stats?: TicketStats | undefined;
}

const options: { value: TicketStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  ...TICKET_STATUSES.map((value) => ({ value, label: statusLabels[value] })),
];

function countFor(stats: TicketStats, status: TicketStatus | undefined): number {
  return status ? stats.byStatus[status] : stats.total;
}

export function StatusFilter({ current, limit, stats }: StatusFilterProps) {
  return (
    <nav aria-label="Filter by status">
      <ul className={styles.filters}>
        {options.map(({ value, label }) => (
          <li key={label}>
            <Link
              className={styles.filter}
              href={listHref({ status: value, limit })}
              aria-current={value === current ? "page" : undefined}
              replace
              scroll={false}
            >
              {label}
              {stats && <span className={styles.count}>{countFor(stats, value)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
