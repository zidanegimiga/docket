import type { AuditEvent } from "@docket/contracts";

import { DISPLAY_TIME_ZONE, formatDateTime } from "@/shared/format/date";

import { describeAuditEvent } from "../../audit-text";
import styles from "./AuditTable.module.css";

interface AuditTableProps {
  events: AuditEvent[];
  emptyMessage: string;
  stale?: boolean;
}

export function AuditTable({ events, emptyMessage, stale = false }: AuditTableProps) {
  if (events.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.scroller}>
      <table className={styles.table} aria-busy={stale || undefined} data-stale={stale}>
        <thead>
          <tr>
            <th scope="col">When ({DISPLAY_TIME_ZONE})</th>
            <th scope="col">Who</th>
            <th scope="col">What</th>
            <th scope="col">Reference</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td className={styles.muted}>
                <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
              </td>
              <td className={styles.who}>{event.actor ? event.actor.label : "Command line"}</td>
              <td className={styles.what}>{describeAuditEvent(event)}</td>
              <td className={styles.reference}>
                {event.requestId && (
                  <span title={`Request ${event.requestId}`}>{event.requestId.slice(0, 8)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
