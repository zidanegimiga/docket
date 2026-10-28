# Adding a feature end to end

A feature is built in vertical slices: contract, then API, then UI, each layer finished and
tested before the next starts. Every step is its own small commit and every commit leaves the
build green.

## Order of work

| Step | Commit                                                           | Guide                                     |
| ---- | ---------------------------------------------------------------- | ----------------------------------------- |
| 1    | `feat(contracts): add <thing> schema`                            | [Endpoint, step 1](adding-an-endpoint.md) |
| 2    | `feat(db): ...` if the data model changes                        | [Module, step 1](adding-a-module.md)      |
| 3    | `feat(api): add <thing> to repository`                           | [Endpoint, step 2](adding-an-endpoint.md) |
| 4    | `feat(api): add <thing> to service` with unit tests              | [Endpoint, step 3](adding-an-endpoint.md) |
| 5    | `feat(api): add <thing> endpoint`                                | [Endpoint, step 4](adding-an-endpoint.md) |
| 6    | `test(api): add integration tests for <thing>`                   | [Endpoint, step 5](adding-an-endpoint.md) |
| 7    | `feat(web): add <thing> api client and query`                    | below                                     |
| 8    | `feat(web): add <component>`                                     | [Component](adding-a-component.md)        |
| 9    | `feat(web): prefetch <thing> on the server` if read on page load | below                                     |
| 10   | `test(web): add <thing> component tests`                         | [Component, tests](adding-a-component.md) |

## Web data layer

Everything for a feature's data lives in `apps/web/src/features/<feature>/api/` and `hooks/`.

File names follow the tickets feature: fetchers in `tickets.api.ts` (named after the resource
endpoint), keys in `ticket.keys.ts` and query options in `ticket.queries.ts`.

**Fetch function** in the `.api.ts` file. Always parse the response with the contract:

```ts
export async function getTicketStats(signal?: AbortSignal): Promise<TicketStats> {
  const data = await request<unknown>("/tickets/stats", { ...(signal && { signal }) });
  return ticketStatsSchema.parse(data);
}
```

**Query key** in the `.keys.ts` file, nested under the feature root so one invalidation refreshes
everything related:

```ts
export const ticketKeys = {
  all: ["tickets"] as const,
  lists: () => [...ticketKeys.all, "list"] as const,
  list: (query: ListTicketsQuery) => [...ticketKeys.lists(), query] as const,
  stats: () => [...ticketKeys.all, "stats"] as const,
};
```

**Query options** in the `.queries.ts` file, shared by the server prefetch and the client hook.
The optional context carries the caller's credentials when rendering on the server; the browser
sends cookies on its own:

```ts
export function ticketStatsQuery(context?: RequestContext) {
  return queryOptions({
    queryKey: ticketKeys.stats(),
    queryFn: ({ signal }) => getTicketStats(signal, context),
  });
}
```

**Hooks** in `hooks/`. Reads wrap `useQuery(options)`. Writes use `useMutation` and invalidate the
feature root on success. Use an optimistic update only when the change is small and very likely
to succeed, and always pair it with a snapshot and rollback (see `useUpdateTicket`).

**Server prefetch** in the page, in parallel with anything else the page needs. Skip it when the
access token has lapsed; the browser then renews the session and loads the data itself:

```ts
const context = await serverRequestContext();
if (context) {
  await Promise.all([
    queryClient.prefetchQuery(ticketListQuery(query, context)),
    queryClient.prefetchQuery(ticketStatsQuery(context)),
  ]);
}
```

**Pages and permissions.** Signed-in pages go under `src/app/(app)/`, whose layout handles the
session and pending users. Hide controls the user cannot use with `<RequirePermission>` or the
helpers in `features/auth/permissions.ts`, mirroring the API's rule.

## State placement

- Server data belongs in the query cache.
- Anything that should survive a reload or a shared link (filters, page, sort) belongs in the URL,
  parsed with the contract schema and falling back to defaults when invalid.
- Form input stays in the DOM until submit.
- Do not add a global store for data that already has one of the homes above.

## Definition of done

- [ ] Contract, API and UI agree, enforced by shared schemas
- [ ] API routes guarded by permission; UI hides what the user's permissions do not allow
- [ ] Unit, integration and component tests cover success, validation and failure paths
- [ ] Each new test was seen failing when the behaviour it covers was broken
- [ ] Accessible names and error announcements checked in component tests
- [ ] Works in light and dark mode and at phone width
- [ ] `npm run check` and `npm run build` pass
- [ ] README updated if the API, setup or a decision changed
