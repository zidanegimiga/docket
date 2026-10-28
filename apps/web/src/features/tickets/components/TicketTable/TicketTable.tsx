import type { Ticket } from "@docket/contracts";

import { DISPLAY_TIME_ZONE, formatDateTime } from "@/shared/format/date";

import { statusLabels } from "../../labels";
import { PriorityText } from "../PriorityText";
import { TicketStatusSelect } from "../TicketStatusSelect";
import styles from "./TicketTable.module.css";

interface TicketTableProps {
  tickets: Ticket[];
  emptyMessage: string;
  stale?: boolean;
  /** Whether the viewer may change a ticket's status; otherwise the status is shown as text. */
  canUpdate?: (ticket: Ticket) => boolean;
}

const readOnly = () => false;

export function TicketTable({
  tickets,
  emptyMessage,
  stale = false,
  canUpdate = readOnly,
}: TicketTableProps) {
  if (tickets.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.scroller}>
      <table className={styles.table} aria-busy={stale || undefined} data-stale={stale}>
        <thead>
          <tr>
            <th scope="col" className={styles.idColumn}>
              #
            </th>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Created ({DISPLAY_TIME_ZONE})</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td className={styles.id}>{ticket.id}</td>
              <td className={styles.titleCell}>
                <span className={styles.title}>{ticket.title}</span>
                {ticket.description && (
                  <span className={styles.description}>{ticket.description}</span>
                )}
              </td>
              <td>
                {canUpdate(ticket) ? (
                  <TicketStatusSelect ticket={ticket} />
                ) : (
                  <span className={styles.status} data-status={ticket.status}>
                    {statusLabels[ticket.status]}
                  </span>
                )}
              </td>
              <td>
                <PriorityText priority={ticket.priority} />
              </td>
              <td className={styles.date}>
                <time dateTime={ticket.createdAt}>{formatDateTime(ticket.createdAt)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
