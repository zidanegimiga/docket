import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";

import { makeQueryClient } from "@/shared/query/query-client";

export function createTestQueryClient(): QueryClient {
  const client = makeQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retry: false },
  });
  return client;
}

export function renderWithClient(
  ui: ReactElement,
  client = createTestQueryClient(),
): RenderResult & { client: QueryClient } {
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}
