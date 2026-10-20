import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ticketListQuery, ticketStatsQuery } from "@/features/tickets/api/ticket.queries";
import { CreateTicketForm } from "@/features/tickets/components/CreateTicketForm";
import { TicketList } from "@/features/tickets/components/TicketList";
import { parseListQuery } from "@/features/tickets/list-query";
import { getQueryClient } from "@/shared/query/query-client";

import styles from "./page.module.css";

interface TicketsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const query = parseListQuery(await searchParams);
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(ticketListQuery(query)),
    queryClient.prefetchQuery(ticketStatsQuery()),
  ]);

  return (
    <div className={styles.layout}>
      <section className={styles.tickets} aria-labelledby="tickets-heading">
        <h1 id="tickets-heading">Tickets</h1>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <TicketList />
        </HydrationBoundary>
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
