# Web notes

Next.js 16 App Router, React 19, TanStack Query 5, CSS Modules, Vitest with Testing Library and
MSW. Read the root [AGENTS.md](../../AGENTS.md) first; [README.md](README.md) explains the design
in depth.

## How the app talks to the API

- The browser calls `/api/*`, which `next.config.ts` rewrites to the API. There is no CORS and
  cookies stay on the web origin.
- Server components call the API directly at `API_URL`. They are not sent the browser's cookies
  automatically: pass `await serverRequestContext()` (from `features/auth/server-session.ts`) to
  query options, and skip the prefetch when it returns `null`.
- `shared/api/http-client.ts` is the only place that calls `fetch`. In the browser it renews an
  expired session once (shared across concurrent requests), retries, and sends the user to
  `/login` when renewal fails. Feature code never handles 401s itself.

## Routes and sessions

```
src/proxy.ts            optimistic redirect: no session cookies → /login?returnTo=...
src/app/(auth)/         login and sign-up; public
src/app/(app)/          everything else; its layout wraps pages in SessionGate
```

- A new signed-in page goes under `(app)/`; it gets the header, the pending-user screen and
  session handling for free. A new public page needs its path added to `AUTH_PAGES` in
  `src/proxy.ts`.
- `useCurrentUser()` gives the signed-in user anywhere under `(app)`.
- Hide what the user cannot do with `<RequirePermission permission="...">` or the helpers in
  `features/auth/permissions.ts`. These mirror API rules for display only; the API still decides.

## Adding a feature

Follow [docs/guides/adding-a-feature.md](../../docs/guides/adding-a-feature.md) and
[adding-a-component.md](../../docs/guides/adding-a-component.md). In short:

```
features/<feature>/api/<resource>.api.ts      fetchers; parse every response with the contract
features/<feature>/api/<thing>.keys.ts        query keys nested under one root
features/<feature>/api/<thing>.queries.ts     queryOptions(..., context?) shared by server and client
features/<feature>/hooks/use<Thing>.ts        useQuery / useMutation wrappers
features/<feature>/components/<Name>/         Name.tsx, Name.module.css, index.ts
```

- Server data lives in the query cache, shareable view state in the URL, form input in the DOM
  until submit. There is no global store.
- Mutations invalidate the feature's root key. Optimistic updates always snapshot and roll back.
- API error codes map to user-facing text in one place per feature (see `features/auth/messages.ts`).

## Rendering rules

- Render the same markup on server and client: dates through `shared/format/date.ts` in UTC, no
  `Date.now()`, `Math.random()` or `window` checks during render.
- `suppressHydrationWarning` is set on `<html>` and `<body>` only, for attributes that browser
  extensions inject. Do not add it elsewhere to hide a real mismatch.
- The Content Security Policy in `shared/config/security-headers.ts` allows no inline styles or
  third-party origins in production. Zod runs in `jitless` mode for the same reason.

## Styling

- One `.module.css` per component, using the tokens in `shared/styles/tokens.css`. No new colours,
  sizes or fonts outside the tokens; light and dark mode both come from them.
- Keep the plain, dense look of the existing screens. Reuse `Button`, `TextField`, `Select`,
  `TextArea` and `Field` rather than styling raw elements.
- Every control has a visible label or an accessible name, errors are linked with
  `aria-describedby`, and status messages use `role="status"` or `role="alert"`.

## Tests

| Folder            | Environment | Use for                               |
| ----------------- | ----------- | ------------------------------------- |
| `tests/unit`      | Node        | Pure functions, the proxy             |
| `tests/component` | jsdom + MSW | Components, hooks and the HTTP client |

- Render with `renderWithClient` from `tests/support/render.tsx`. Unhandled requests fail the test.
- `tests/support/server.ts` signs in a default user with every ticket permission; override
  `/api/auth/me` with `makeUser({...})` to test other permissions or a pending user.
- Mock `next/navigation` per test file with `vi.mock` when a component uses the router or search
  params.
- Query by role and accessible name, the way a user or screen reader would.

## Commands

```bash
npm run dev -w @docket/web          # needs the API on :4000 (or API_URL)
npm test -w @docket/web             # unit and component tests
npm run build -w @docket/web        # production build, also type-checks routes
```
