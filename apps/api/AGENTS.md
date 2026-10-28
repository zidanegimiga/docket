# API notes

Express 5, Prisma 7 on PostgreSQL, Zod 4, Vitest. Read the root [AGENTS.md](../../AGENTS.md)
first; [README.md](README.md) explains the design in depth.

## How a request flows

```
app.ts       security headers → request id → request log → origin check → JSON body → cookies
routes.ts    maps URL prefixes to module routers; builds the shared authenticate middleware
module       authenticate → requirePermission → validate → controller → service → repository
errors       thrown AppError subclasses become { error: { code, message, details, requestId } }
```

Controllers are arrow properties with no try/catch: Express 5 forwards rejected promises.
`validate()` replaces `req.params`, `req.query` and `req.body` with parsed values and infers their
types, so a controller's generics must match its route's schemas.

## Adding to the API

Follow [docs/guides/adding-an-endpoint.md](../../docs/guides/adding-an-endpoint.md) or
[adding-a-module.md](../../docs/guides/adding-a-module.md). The parts most often missed:

- **Protect the route.** `router.use(authenticate)` at the top of the module router, then
  `requirePermission("<permission>")` before `validate(...)` on each route, so callers without
  access get 403 before any 400.
- **Use the caller.** `principalOf(req)` gives `{ userId, status, permissions }`. Pass it to the
  service; never trust a user id from the request body.
- **Ownership is a policy.** Rules such as "only your own tickets" live in `<module>.policy.ts`
  and are enforced inside the repository's write (`where: { id, createdById }`) so the check
  cannot go stale between a read and a write.
- **Repositories select columns explicitly** (`ticketColumns`, `adminUserColumns`) so new
  database columns never leak into responses. Map records to entities; password hashes never
  leave the repository.
- **Avoid N+1.** Load relations with Prisma `select` in one `findMany`; count queries with
  `Promise.all` beside it. `LIKE` searches must escape `%`, `_` and `\` (see
  `admin-users.repository.ts`).
- **Business failures are typed errors** from `src/shared/errors/` with a stable `code` the web
  app can branch on. Add the code to the web app's messages if users can see it.

## Identity module

`src/modules/identity/` owns sign-up, login, OAuth, sessions, email verification and the admin
endpoints. [docs/authentication.md](../../docs/authentication.md) describes the design; key points:

- Access tokens are 10-minute EdDSA JWTs carrying status and permissions. Permission changes
  apply when the token is next refreshed, not instantly.
- Refresh tokens are opaque, stored as SHA-256 hashes, rotated on every use. Reusing a rotated
  token after the grace period revokes the whole family.
- Pending users can sign in but hold no permissions. Only `admin:promote` (a CLI) creates the
  first administrator.
- Third-party integrations sit behind interfaces in `src/core/` (`PasswordHasher`,
  `TokenIssuer`, `OAuthProvider`, `EmailSender`). Add a provider by implementing one and wiring it
  in `src/core/identity/identity.ts`, never by calling an SDK from a module.

## Tests

| Folder              | Runs against                               | Use for                             |
| ------------------- | ------------------------------------------ | ----------------------------------- |
| `tests/unit`        | In-memory fakes in `tests/helpers/`        | Services, policies, pure functions  |
| `tests/integration` | The real app (Supertest) and `docket_test` | Routes, repositories, SQL behaviour |

- Build the app with `createTestContainer()` and call `resetDatabase(container)` in `beforeEach`.
- Authenticate with `signIn(container, { roles, status })`, which seeds a user and returns bearer
  headers. Cover anonymous (401), pending (`ACCOUNT_PENDING`) and missing-permission
  (`PERMISSION_DENIED`) callers for every new protected route.
- When a repository interface changes, update the Prisma implementation and the in-memory fake in
  the same commit.
- Parse successful responses with the contract schema; for rejected writes, assert the stored data
  did not change.

## Commands

```bash
npm run dev -w @docket/api                                   # watch mode, reads apps/api/.env
npm test -w @docket/api                                      # unit and integration
npm run db:migrate -w @docket/api -- --name <change>         # new migration
npm run db:generate -w @docket/api                           # regenerate the Prisma client
npm run auth:keys -w @docket/api                             # new token signing key
npm run admin:promote -w @docket/api -- --email <address>    # make an account administrator
```
