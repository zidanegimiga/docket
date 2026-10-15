import type { ListTicketsQuery } from "@docket/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ticketListQuery } from "../api/ticket.queries";

export function useTickets(query: ListTicketsQuery) {
  return useQuery({
    ...ticketListQuery(query),
    placeholderData: keepPreviousData,
  });
}
