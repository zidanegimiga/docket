import { Suspense } from "react";

import { CreateTicketForm } from "@/features/tickets/components/CreateTicketForm";
import { TicketList } from "@/features/tickets/components/TicketList";

import styles from "./page.module.css";

export default function TicketsPage() {
  return (
    <div className={styles.layout}>
      <section className={styles.tickets} aria-labelledby="tickets-heading">
        <h1 id="tickets-heading">Tickets</h1>
        <Suspense>
          <TicketList />
        </Suspense>
      </section>

      <aside className={styles.newTicket} aria-labelledby="new-ticket-heading">
        <h2 id="new-ticket-heading" className={styles.panelHeading}>
          New ticket
        </h2>
        <CreateTicketForm />
      </aside>
    </div>
  );
}
