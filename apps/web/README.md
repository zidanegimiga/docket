# Docket web

Next.js 16 app for browsing, filtering, creating and updating tickets. Data comes from the
[Docket API](../api/README.md) and every response is checked against
[`@docket/contracts`](../../packages/contracts/README.md).

Back to the [project README](../../README.md).

## Contents

- [Running](#running)
- [Layout](#layout)
- [Rendering](#rendering)
- [State](#state)
- [Data fetching](#data-fetching)
- [Optimistic status changes](#optimistic-status-changes)
- [Components and styling](#components-and-styling)
- [Accessibility](#accessibility)
- [Testing](#testing)
- [Environment](#environment)

## Running

From the repository root, with the API running:

```bash
npm run dev -w @docket/web
```

The app runs on <http://localhost:3000> and proxies `/api/*` to `API_URL`
(default `http://localhost:4000`).

## Layout

```
apps/web/
├── src/
│   ├── app/                  Next.js routes, root layout, global CSS and providers
│   ├── features/             One folder per business capability
│   │   └── tickets/
│   │       ├── api/          Fetch functions, query keys and query options
│   │       ├── hooks/        useTickets, useTicketStats, useCreateTicket, useUpdateTicket
│   │       ├── components/   One folder per component: .tsx, .module.css, index.ts
│   │       ├── labels.ts     Human labels for enum values
│   │       └── list-query.ts URL search params to list query, and back
│   └── shared/               Code with no feature knowledge
│       ├── api/              HTTP client and ApiError
│       ├── components/       Button, Field, TextField, TextArea, Select, Pagination, AppHeader
│       ├── config/           API URL resolution
│       ├── format/           Date formatting
│       ├── forms/            Mapping validation issues to field errors
│       ├── query/            QueryClient factory
│       └── styles/           Design tokens as CSS custom properties
└── tests/
    ├── unit/                 Pure functions in Node
    ├── component/            React Testing Library in jsdom, network mocked with MSW
    └── support/              Render helper, fixtures, MSW server and setup
```

Import rules: `shared/` never imports from `features/`. Features never import from each other.

## Rendering

The tickets page is a server component. It reads `searchParams`, prefetches the list and the stats
in parallel into a per-request `QueryClient`, and hands the cache to the browser through
`HydrationBoundary`. The first paint already contains the table and the counts, and the browser
makes no API request on load. Client components then read the same cache through TanStack Query.

```
request /?status=open
  └─ page.tsx (server)
       ├─ parseListQuery(searchParams)        same parser the client uses
       ├─ prefetch ticketListQuery(query)     ┐ in parallel
       ├─ prefetch ticketStatsQuery()         ┘
       └─ <HydrationBoundary> → TicketList (client) reads the cache, no refetch
```

The server calls the API directly using `API_URL`. The browser calls `/api/*` on its own origin,
which Next.js rewrites to the API. The API needs no CORS configuration and its URL never ships to
the browser.

## State

| Kind of state                  | Where it lives                                   |
| ------------------------------ | ------------------------------------------------ |
| Server data (tickets, stats)   | TanStack Query cache                             |
| Filter, page and page size     | URL search params                                |
| Form input                     | The DOM (uncontrolled inputs read with FormData) |
| Per-row saving and error state | Each row's own mutation hook                     |

There is no global store. The URL is the only source of truth for what the list shows, so reload,
back, bookmarks and shared links reproduce the same view. Invalid params fall back to the default
view rather than an error page. The filter tabs and the pager are real links that work before
JavaScript loads and support open in new tab.

## Data fetching

- Query keys are nested: `["tickets"]`, `["tickets", "list", query]`, `["tickets", "stats"]`.
  Creating or updating a ticket invalidates `["tickets"]`, which refreshes every list page and the
  stats together.
- Query options are defined once with `queryOptions()` and used by both the server prefetch and the
  client hooks, so they cannot disagree on a key.
- Every response is parsed with the contract schema at the boundary, so an unexpected shape fails
  loudly in the API layer instead of rendering `undefined` deep in a component.
- All failures surface as one `ApiError` type carrying the API's `code`, `details` and
  `requestId`, including network failures (`NETWORK_ERROR`).
- Previous list data stays on screen while the next page loads, and the table dims instead of
  flashing empty.
- Queries retry once on server and network errors, never on 4xx responses.
- The server creates a new `QueryClient` per request so data never leaks between users; the
  browser keeps one so a suspended render cannot discard the cache.

## Optimistic status changes

Changing a status updates the row immediately. `useUpdateTicket`:

1. cancels in-flight list fetches so they cannot overwrite the change,
2. snapshots every cached list page and patches the ticket in all of them,
3. restores the snapshot if the request fails,
4. invalidates ticket queries once it settles, so filtered lists regroup and stats refresh.

The status select reads its value from the cache, so the optimistic value and the rollback show
without local state. Stats are not patched optimistically; they refresh a moment later.

## Components and styling

- Every component is a folder with `<Name>.tsx`, `<Name>.module.css` and `index.ts`. Shared ones
  live in `shared/components`, feature ones in `features/<feature>/components`.
- Components are presentational by default. `TicketTable` renders tickets; `TicketList` owns the
  query, the URL state, the filter and the pager.
- Global CSS is limited to element defaults and design tokens (`shared/styles/tokens.css`): type,
  spacing, radius and colour, with a dark scheme that only overrides colours.
- The look is a plain internal tool: system fonts, a 14px base for dense tables, warm neutrals with
  one muted accent, 1px borders, small radii, no shadows and no icon set.
- No component library. The few controls needed are small and fully owned.
- Dates are formatted in a fixed locale and UTC, named in the column header, so server and client
  render identical markup.

See [adding a component](../../docs/guides/adding-a-component.md) for the full conventions.

## Accessibility

- Every control has a label. Field errors and hints are linked with `aria-describedby` and invalid
  fields are marked `aria-invalid`.
- Status selects are named per row, for example "Status for ticket #11".
- Success uses `role="status"`; failures use `role="alert"`.
- Status and priority are always written out, never shown by colour alone.
- Filter links mark the current one with `aria-current="page"` and read as "Open 6", with a real
  space between the label and the count.

## Testing

```bash
npm run test:unit -w @docket/web          # pure helpers in Node
npm run test:component -w @docket/web     # components in jsdom
```

| Kind      | Location          | Approach                                                        |
| --------- | ----------------- | --------------------------------------------------------------- |
| Unit      | `tests/unit`      | Pure functions such as URL parsing, no DOM                      |
| Component | `tests/component` | Testing Library with a real QueryClient and MSW for the network |

- **Mock the network, not the code.** MSW intercepts real HTTP, so tests run through the actual
  client, error mapping and schema parsing. Any request without a handler fails the test. A
  default stats response lives in `tests/support/server.ts`.
- **Query like a user.** Elements are found by role and accessible name, never by class or test
  id, so passing tests also mean the labels are right.
- **Assert at the boundary.** Request bodies are read from MSW, which proves trimming and dropped
  fields against the real client.
- **Hold responses open** to test optimistic states and rollbacks deterministically.
- Only `next/navigation` is mocked, because `useSearchParams` needs the Next.js runtime.

## Environment

| Variable  | Default                 | Read when                                                                |
| --------- | ----------------------- | ------------------------------------------------------------------------ |
| `API_URL` | `http://localhost:4000` | At build time for the `/api` rewrite, at runtime for server-side fetches |

Because the rewrite is baked into the build, `API_URL` must be set before `next build` (and is
declared as a build input in `turbo.json` so Turborepo passes it through).
