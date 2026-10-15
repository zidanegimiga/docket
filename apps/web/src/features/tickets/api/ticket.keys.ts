import type { ListTicketsQuery } from "@docket/contracts";

export const ticketKeys = {
  all: ["tickets"] as const,
  lists: () => [...ticketKeys.all, "list"] as const,
  list: (query: ListTicketsQuery) => [...ticketKeys.lists(), query] as const,
  stats: () => [...ticketKeys.all, "stats"] as const,
};
