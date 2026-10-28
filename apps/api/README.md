# Docket API

REST API for tickets, built on Express 5, Prisma 7 and PostgreSQL. Request and response shapes
come from [`@docket/contracts`](../../packages/contracts/README.md).

Back to the [project README](../../README.md).

## Contents

- [Running](#running)
- [Layout](#layout)
- [Layers](#layers)
- [Composition root and providers](#composition-root-and-providers)
- [Validation](#validation)
- [Errors](#errors)
- [Observability](#observability)
- [Process lifecycle](#process-lifecycle)
- [Data model](#data-model)
- [Endpoints](#endpoints)
- [Testing](#testing)
- [Environment](#environment)

## Running

From the repository root, with the database running (`docker compose up -d db`):

```bash
cp apps/api/.env.example apps/api/.env
npm run db:deploy -w @docket/api
npm run dev -w @docket/api
```

The API listens on <http://localhost:4000>. Use `npm run db:migrate -w @docket/api` to create a
new migration after changing `prisma/schema.prisma`.

### The first administrator

New accounts wait for an administrator's approval, so the first administrator is made from the
command line. Sign up in the app (with a password or Google), then promote that account:

```bash
npm run admin:promote -w @docket/api -- --email you@example.com
```

It activates the account and adds the `admin` role, and is safe to run again. It reads
`DATABASE_URL` from `apps/api/.env`; to promote someone in a deployed database, set
`DATABASE_URL` for that one command instead. The script never takes a password, and the API has
no way to become an administrator without an existing one.

## Layout

```
apps/api/
├── prisma/
│   ├── schema.prisma         Data model and Postgres enums
│   └── migrations/           SQL migrations, committed and applied with migrate deploy
├── src/
│   ├── core/                 Infrastructure. Each concern is an interface plus one implementation.
│   │   ├── config/           Environment parsed and validated with Zod at startup
│   │   ├── database/         DatabaseProvider interface, Prisma implementation
│   │   ├── logger/           Logger interface, Pino implementation
│   │   └── monitoring/       Monitor interface (errors, metrics), logger-backed implementation
│   ├── shared/               Cross-module building blocks with no business knowledge
│   │   ├── errors/           AppError and its subclasses (NotFound, Validation)
│   │   ├── http/             Pagination envelope helper
│   │   └── middleware/       Request context, request logging, validation, 404, error handler
│   ├── modules/              One folder per business capability
│   │   ├── health/           GET /health
│   │   └── tickets/          routes, controller, service, repository, schemas, types, index
│   ├── types/                Express type augmentation (req.id, req.log)
│   ├── app.ts                Builds the Express app from its dependencies, never listens
│   ├── routes.ts             The only place that maps URL prefixes to modules
│   ├── container.ts          Composition root: the only place concrete providers are created
│   └── server.ts             Process entry: env, container, connect, listen, graceful shutdown
└── tests/
    ├── unit/                 Services against in-memory fakes, no database
    ├── integration/          HTTP through Supertest against a real database
    └── helpers/              Fakes, test container, database reset and seeding
```

Import rules: business code imports interfaces from `core/`, never implementations. `shared/`
knows nothing about any module. Modules never import from each other.

## Layers

Every module follows the same shape. Using tickets as the reference:

| File                   | Responsibility                                                             | Knows about         |
| ---------------------- | -------------------------------------------------------------------------- | ------------------- |
| `ticket.routes.ts`     | Maps method and path to a controller method and attaches validation        | Express, schemas    |
| `ticket.controller.ts` | Reads the validated request, calls the service, shapes the response        | Express, service    |
| `ticket.service.ts`    | Business rules: 404 decisions, zero-filling stats, metrics                 | Repository, monitor |
| `ticket.repository.ts` | Prisma queries only                                                        | Prisma              |
| `ticket.types.ts`      | Domain entity and the repository interface the service depends on          | Contracts           |
| `ticket.schemas.ts`    | Schemas only the API needs, such as the `:id` param                        | Zod                 |
| `index.ts`             | `createTicketModule(deps)`: builds repository, service, controller, routes | Everything above    |

The service imports the repository interface from `ticket.types.ts`, not the Prisma class, so it
is unit tested with an in-memory fake. Controllers stay a few lines long because validation has
already parsed, coerced and defaulted the input before they run.

To add to this, see [adding an endpoint](../../docs/guides/adding-an-endpoint.md) and
[adding a module](../../docs/guides/adding-a-module.md).

## Composition root and providers

External concerns sit behind small interfaces in `src/core/`:

- `Logger`: `debug/info/warn/error(message, context)` and `child(bindings)`. Implemented with
  Pino. Production writes JSON to stdout; development uses pino-pretty.
- `Monitor`: `captureException` and `recordMetric`. The default implementation writes structured
  log entries, so a hosted service such as Sentry can replace it in one file.
- `DatabaseProvider`: `connect`, `disconnect` and `healthCheck`, plus the typed client.
  `healthCheck` returns `false` instead of throwing so `/health` can report a degraded state.

`container.ts` is the only file that constructs implementations. It takes a parsed environment
instead of reading `process.env`, which is how tests build the real app against a test database.
Wiring is plain constructor injection with no DI framework; the whole dependency graph fits on one
screen.

## Validation

`validate({ params, query, body })` is a generic middleware. Its return type is derived from the
schemas it receives, so a controller expecting a typed query only compiles on a route that
validates into that shape. Parsed values replace the raw ones, so coercion (`"7"` to `7`), defaults
and stripping take effect before the controller runs. All issues across params, query and body
are reported in one 400.

Request bodies are strict objects and reject unknown fields. Query strings are tolerant and drop
unknown params, because proxies and tooling add their own.

## Errors

Errors that extend `AppError` carry a status code, a stable machine-readable `code` and optional
`details`. The error handler returns them in one envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [{ "path": "body.title", "message": "Title is required" }],
    "requestId": "f96ac72f-c975-440d-ad1f-7844b70e7c93"
  }
}
```

Anything that is not an `AppError` goes to the monitor and comes back as a generic 500, so
internals never reach the client. Malformed and oversized JSON bodies map to 400 and 413 instead
of surfacing as server errors. Unknown routes go through the same handler as a `NotFoundError`.

## Observability

- Every request gets an id, from a well-formed incoming `x-request-id` or a new UUID. It is echoed
  in the response header, attached to every log line through a child logger, and included in every
  error response so a user can quote it.
- One log line per request with method, path, matched route, status and duration, at a level
  chosen by status (5xx error, 4xx warn, otherwise info).
- Request duration is recorded as a metric tagged by route pattern (`/tickets/:id`), never the raw
  URL, to keep tag cardinality bounded. Business metrics such as `tickets.created` live in the
  service, so they fire whatever the entry point.

## Process lifecycle

`server.ts` validates the environment, connects to the database and only then listens, so a
broken deploy fails before it accepts traffic. On SIGTERM or SIGINT it stops accepting
connections, drains in-flight requests, disconnects from the database and lets the process exit
naturally. A ten second timer forces the exit if something hangs.

## Data model

```prisma
enum TicketStatus   { open in_progress closed }
enum TicketPriority { low medium high }

model Ticket {
  id          Int            @id @default(autoincrement())
  title       String         @db.VarChar(200)
  description String?
  status      TicketStatus   @default(open)
  priority    TicketPriority @default(medium)
  createdAt   DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime       @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([status, createdAt])
}
```

- Status and priority are real Postgres enums, so invalid values are rejected by the database even
  if they get past the API.
- New tickets get `open` from the database default, not from application code.
- The composite index backs the main query: filter by status, newest first.
- Lists sort by `created_at DESC, id DESC`. The id tie-breaker keeps ordering stable when two
  tickets share a timestamp, so no row appears on two pages or none.
- A page and its total come from one `REPEATABLE READ` transaction, so they describe the same
  snapshot.
- Updates are a single `UPDATE ... WHERE id`. Prisma's record-not-found error becomes `null` in the
  repository and a 404 in the service; every other database error is rethrown so an outage is
  never reported as a missing ticket.
- Stats are one `GROUP BY status`; the service fills in zero for statuses with no tickets and
  derives the total from the same counts.

## Endpoints

All errors use the envelope shown in [Errors](#errors).

### `POST /tickets`

```http
POST /tickets
Content-Type: application/json

{ "title": "Printer on floor 2 jammed", "description": "Tray 3", "priority": "high" }
```

`201 Created` with the ticket. `title` is required (1 to 200 characters after trimming).
`description` is optional. `priority` defaults to `medium`. New tickets always start `open`, and a
`status` field in the body is rejected.

```json
{
  "id": 12,
  "title": "Printer on floor 2 jammed",
  "description": "Tray 3",
  "status": "open",
  "priority": "high",
  "createdAt": "2026-10-15T10:37:26.862Z",
  "updatedAt": "2026-10-15T10:37:26.862Z"
}
```

### `GET /tickets?status=&page=&limit=`

| Param    | Default | Rules                             |
| -------- | ------- | --------------------------------- |
| `status` | none    | `open`, `in_progress` or `closed` |
| `page`   | `1`     | Integer, at least 1               |
| `limit`  | `20`    | Integer, 1 to 100                 |

```json
{
  "data": [{ "id": 12, "title": "Printer on floor 2 jammed", "status": "open", "...": "..." }],
  "pagination": { "page": 1, "limit": 20, "total": 41, "totalPages": 3 }
}
```

Newest first. A page past the end returns `200` with empty `data`.

### `PATCH /tickets/:id`

```http
PATCH /tickets/12
Content-Type: application/json

{ "status": "in_progress" }
```

`200 OK` with the updated ticket. Accepts `status`, `priority` or both; anything else is rejected.
`404` if the ticket does not exist. The id must be a plain positive integer within the database
range, so `/tickets/1e3` or `/tickets/99999999999` return `400`.

### `GET /tickets/stats`

```json
{ "total": 9, "byStatus": { "open": 6, "in_progress": 1, "closed": 2 } }
```

Every status is present even when its count is zero.

### `GET /health`

`200` with `{ "status": "ok", "checks": { "database": "up" } }`, or `503` with `"degraded"` when
the database is unreachable.

## Testing

```bash
docker compose up -d db                       # from the repository root
npm run test:unit -w @docket/api              # services against in-memory fakes
npm run test:integration -w @docket/api       # HTTP against PostgreSQL
```

| Kind        | Location            | Approach                                                            |
| ----------- | ------------------- | ------------------------------------------------------------------- |
| Unit        | `tests/unit`        | Services with hand-written fakes that implement the real interfaces |
| Integration | `tests/integration` | Supertest against the real app and a real `docket_test` database    |

- **Fakes over mocks.** `InMemoryTicketRepository`, `RecordingMonitor` and `FakeDatabase`
  implement the real interfaces, so tests assert outcomes rather than call sequences, and a changed
  interface fails to compile.
- **A real database.** Enums, defaults, ordering and transactions are part of the behaviour under
  test. A global setup runs `prisma migrate deploy` against `docket_test` (creating it if needed),
  and every test truncates the table first. Test files run serially because they share it.
- **The app under test is the real one.** `createTestContainer()` goes through the composition
  root with a silent logger, so middleware order, validation and error handling are all covered.
- **Contracts in assertions.** Responses are parsed with the shared schemas, so an omitted field or
  status fails even when no assertion names it.
- **Data with controlled timestamps.** `seedTickets` inserts rows directly with exact `createdAt`
  values, so ordering tests never depend on insert timing.

Set `TEST_DATABASE_URL` to use a different database.

## Environment

| Variable                                   | Default                 | Purpose                                                                                                             |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | none                    | PostgreSQL connection string (required)                                                                             |
| `PORT`                                     | `4000`                  | HTTP port                                                                                                           |
| `NODE_ENV`                                 | `development`           | `development` enables pretty logs                                                                                   |
| `LOG_LEVEL`                                | `info`                  | `fatal` to `trace`, or `silent`                                                                                     |
| `TRUST_PROXY_HOPS`                         | `1`                     | Proxies in front of the API; picks the client IP from `X-Forwarded-For`                                             |
| `WEB_ORIGIN`                               | `http://localhost:3000` | The web app's origin, for the Origin check and OAuth redirects                                                      |
| `PUBLIC_API_PREFIX`                        | `/api`                  | Path under which browsers reach the API (the web app's rewrite); scopes the refresh cookie                          |
| `AUTH_PRIVATE_KEY`                         | none                    | Ed25519 signing key (`npm run auth:keys -w @docket/api`); required in production                                    |
| `AUTH_ALLOW_EPHEMERAL_KEY`                 | `false`                 | Allow a temporary key in production mode (Docker Compose only)                                                      |
| `AUTH_ISSUER`                              | `http://localhost:4000` | Issuer claim in access tokens                                                                                       |
| `AUTH_AUDIENCE`                            | `docket-api`            | Audience claim in access tokens                                                                                     |
| `ACCESS_TOKEN_TTL_SECONDS`                 | `600`                   | Access token lifetime, 60 to 3600                                                                                   |
| `REFRESH_TOKEN_TTL_DAYS`                   | `30`                    | Refresh token lifetime, 1 to 90                                                                                     |
| `REFRESH_REUSE_GRACE_SECONDS`              | `30`                    | How long a just-rotated refresh token is treated as a tab race rather than theft, 0 to 120                          |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | none                    | Enable Google sign-in when both are set. Register `<WEB_ORIGIN>/api/auth/oauth/google/callback` as the redirect URI |

The environment is validated at startup and every invalid variable is reported at once.
