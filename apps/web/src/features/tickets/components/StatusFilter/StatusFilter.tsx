import { TICKET_STATUSES, type TicketStatus } from "@docket/contracts";
import Link from "next/link";

import { listHref } from "../../list-query";
import { statusLabels } from "../../labels";
import styles from "./StatusFilter.module.css";

interface StatusFilterProps {
  current: TicketStatus | undefined;
  limit: number;
}

const options: { value: TicketStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  ...TICKET_STATUSES.map((value) => ({ value, label: statusLabels[value] })),
];

export function StatusFilter({ current, limit }: StatusFilterProps) {
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
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
