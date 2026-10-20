import { useQuery } from "@tanstack/react-query";

import { ticketStatsQuery } from "../api/ticket.queries";

export function useTicketStats() {
  return useQuery(ticketStatsQuery());
}
