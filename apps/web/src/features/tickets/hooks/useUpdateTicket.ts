import type { Ticket, TicketList, UpdateTicketBody } from "@docket/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ticketKeys } from "../api/ticket.keys";
import { updateTicket } from "../api/tickets.api";

export interface UpdateTicketVariables {
  id: number;
  data: UpdateTicketBody;
}

function applyUpdate(ticket: Ticket, { status, priority }: UpdateTicketBody): Ticket {
  return {
    ...ticket,
    ...(status && { status }),
    ...(priority && { priority }),
  };
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateTicketVariables) => updateTicket(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ticketKeys.lists() });
      const snapshot = queryClient.getQueriesData<TicketList>({ queryKey: ticketKeys.lists() });

      queryClient.setQueriesData<TicketList>({ queryKey: ticketKeys.lists() }, (list) =>
        list
          ? {
              ...list,
              data: list.data.map((ticket) =>
                ticket.id === id ? applyUpdate(ticket, data) : ticket,
              ),
            }
          : list,
      );

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      for (const [queryKey, list] of context?.snapshot ?? []) {
        queryClient.setQueryData(queryKey, list);
      }
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  });
}
