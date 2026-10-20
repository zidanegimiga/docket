import type { ListTicketsQuery } from "@docket/contracts";
import { queryOptions } from "@tanstack/react-query";

import { ticketKeys } from "./ticket.keys";
import { getTicketStats, listTickets } from "./tickets.api";

export function ticketListQuery(query: ListTicketsQuery) {
  return queryOptions({
    queryKey: ticketKeys.list(query),
    queryFn: ({ signal }) => listTickets(query, signal),
  });
}

export function ticketStatsQuery() {
  return queryOptions({
    queryKey: ticketKeys.stats(),
    queryFn: ({ signal }) => getTicketStats(signal),
  });
}
