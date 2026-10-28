import type { ListTicketsQuery } from "@docket/contracts";
import { queryOptions } from "@tanstack/react-query";

import type { RequestContext } from "@/shared/api/http-client";

import { ticketKeys } from "./ticket.keys";
import { getTicketStats, listTickets } from "./tickets.api";

/** The context carries credentials when prefetching on the server; the browser sends cookies. */
export function ticketListQuery(query: ListTicketsQuery, context?: RequestContext) {
  return queryOptions({
    queryKey: ticketKeys.list(query),
    queryFn: ({ signal }) => listTickets(query, signal, context),
  });
}

export function ticketStatsQuery(context?: RequestContext) {
  return queryOptions({
    queryKey: ticketKeys.stats(),
    queryFn: ({ signal }) => getTicketStats(signal, context),
  });
}
