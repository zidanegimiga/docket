"use client";

import { TICKET_STATUSES, ticketStatusSchema, type Ticket } from "@docket/contracts";
import { useId, type ChangeEvent } from "react";

import { useUpdateTicket } from "../../hooks/useUpdateTicket";
import { statusLabels } from "../../labels";
import styles from "./TicketStatusSelect.module.css";

interface TicketStatusSelectProps {
  ticket: Pick<Ticket, "id" | "status">;
}

export function TicketStatusSelect({ ticket }: TicketStatusSelectProps) {
  const updateTicket = useUpdateTicket();
  const errorId = useId();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const status = ticketStatusSchema.safeParse(event.target.value);
    if (!status.success || status.data === ticket.status) return;
    updateTicket.mutate({ id: ticket.id, data: { status: status.data } });
  };

  return (
    <div className={styles.control}>
      <select
        className={styles.select}
        aria-label={`Status for ticket #${ticket.id}`}
        aria-invalid={updateTicket.isError || undefined}
        aria-describedby={updateTicket.isError ? errorId : undefined}
        data-status={ticket.status}
        value={ticket.status}
        disabled={updateTicket.isPending}
        onChange={handleChange}
      >
        {TICKET_STATUSES.map((status) => (
          <option key={status} value={status}>
            {statusLabels[status]}
          </option>
        ))}
      </select>
      {updateTicket.isError && (
        <p id={errorId} className={styles.error} role="alert">
          Not saved. Try again.
        </p>
      )}
    </div>
  );
}
