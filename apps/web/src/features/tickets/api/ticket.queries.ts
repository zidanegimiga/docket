import type { ListTicketsQuery } from "@docket/contracts";
import { queryOptions } from "@tanstack/react-query";

import { ticketKeys } from "./ticket.keys";
import { listTickets } from "./tickets.api";

export function ticketListQuery(query: ListTicketsQuery) {
  return queryOptions({
    queryKey: ticketKeys.list(query),
    queryFn: ({ signal }) => listTickets(query, signal),
  });
}
