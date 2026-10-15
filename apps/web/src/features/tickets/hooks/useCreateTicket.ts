import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTicket } from "../api/tickets.api";
import { ticketKeys } from "../api/ticket.keys";

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  });
}
