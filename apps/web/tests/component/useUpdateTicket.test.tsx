import type { TicketList } from "@docket/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { ticketKeys } from "@/features/tickets/api/ticket.keys";
import { useUpdateTicket } from "@/features/tickets/hooks/useUpdateTicket";

import { makeTicket, makeTicketList } from "../support/fixtures";
import { createTestQueryClient } from "../support/render";
import { server } from "../support/server";

function gate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

function setup() {
  const client = createTestQueryClient();
  const allKey = ticketKeys.list({ page: 1, limit: 20 });
  const openKey = ticketKeys.list({ status: "open", page: 1, limit: 20 });
  client.setQueryData(allKey, makeTicketList([makeTicket({ id: 7 }), makeTicket({ id: 8 })]));
  client.setQueryData(openKey, makeTicketList([makeTicket({ id: 7 })]));

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateTicket(), { wrapper });

  const statusIn = (key: readonly unknown[], id: number) =>
    client.getQueryData<TicketList>(key)?.data.find((ticket) => ticket.id === id)?.status;

  return { client, result, allKey, openKey, statusIn };
}

describe("useUpdateTicket", () => {
  it("updates every cached list before the server responds", async () => {
    const response = gate();
    server.use(
      http.patch("/api/tickets/7", async () => {
        await response.opened;
        return HttpResponse.json(makeTicket({ id: 7, status: "closed" }));
      }),
      http.get("/api/tickets", () => HttpResponse.json(makeTicketList([]))),
    );
    const { result, allKey, openKey, statusIn } = setup();

    act(() => result.current.mutate({ id: 7, data: { status: "closed" } }));

    await waitFor(() => expect(statusIn(allKey, 7)).toBe("closed"));
    expect(statusIn(openKey, 7)).toBe("closed");
    expect(statusIn(allKey, 8)).toBe("open");
    expect(result.current.isPending).toBe(true);

    response.open();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("restores the previous values when the server rejects the update", async () => {
    const response = gate();
    server.use(
      http.patch("/api/tickets/7", async () => {
        await response.opened;
        return HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "x" } },
          { status: 500 },
        );
      }),
      http.get("/api/tickets", () => new Promise<never>(() => {})),
    );
    const { result, allKey, statusIn } = setup();

    act(() => result.current.mutate({ id: 7, data: { status: "closed" } }));
    await waitFor(() => expect(statusIn(allKey, 7)).toBe("closed"));

    response.open();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(statusIn(allKey, 7)).toBe("open");
  });

  it("sends only the changed field and refreshes ticket queries afterwards", async () => {
    let body: unknown;
    server.use(
      http.patch("/api/tickets/7", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeTicket({ id: 7, priority: "high" }));
      }),
      http.get("/api/tickets", () => new Promise<never>(() => {})),
    );
    const { client, result, allKey } = setup();

    act(() => result.current.mutate({ id: 7, data: { priority: "high" } }));

    await waitFor(() => expect(client.getQueryState(allKey)?.isInvalidated).toBe(true));
    expect(body).toEqual({ priority: "high" });
  });
});
