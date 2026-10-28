# Docket

A support ticket tracker. Tickets have a title, an optional description, a status (open, in
progress, closed) and a priority (low, medium, high). The web app lists tickets with a status
filter and pagination, shows how many tickets sit in each status, creates new tickets and changes
status inline, all through a small REST API backed by PostgreSQL.

| Live         | URL                                           |
| ------------ | --------------------------------------------- |
| Web app      | <https://docket-puce-eight.vercel.app>        |
| API          | <https://docket-api-rfhp.onrender.com>        |
| Health check | <https://docket-api-rfhp.onrender.com/health> |

The API runs on Render's free tier and sleeps after 15 minutes without traffic. If the first page
load is slow, the API is waking up; it takes up to a minute and is fast from then on.

## Quick start

With Docker:

```bash
docker compose up --build
```

The web app runs on <http://localhost:3000> and the API on <http://localhost:4000>. The API
applies migrations when it starts.

For local development (Node 22, npm 11, Docker for the database):

```bash
npm install
docker compose up -d db
cp apps/api/.env.example apps/api/.env
npm run db:deploy -w @docket/api
npm run dev
```

Tests need the database running:

```bash
npm test               # all API and web tests
npm run typecheck      # every workspace
npm run build          # production builds
npm run format:check   # Prettier
```

## How it fits together

```
Browser ──► Next.js (apps/web) ──► Express API (apps/api) ──► PostgreSQL
            server-rendered pages     routes → controller →
            /api/* rewritten to       service → repository
            the API (no CORS)         (Prisma)
```

- **One contract, two apps.** Request and response shapes are Zod schemas in
  `packages/contracts`. The API validates input with them, the web app validates responses with
  them, and tests parse every response with them, so the two sides cannot drift.
- **Dependencies point inwards.** Business logic depends on interfaces (repository, logger,
  monitor), never on Express, Prisma or Pino. Implementations are created in one composition root
  and passed in, so any of them can be swapped or faked in tests.
- **Server first, then interactive.** Pages are rendered on the server with data already loaded,
  then TanStack Query takes over in the browser. The URL holds the filter and page; the query
  cache holds server data; there is no global store.

## Repository layout

```
docket/
├── apps/
│   ├── api/                Express API              → apps/api/README.md
│   └── web/                Next.js app              → apps/web/README.md
├── packages/
│   ├── contracts/          Shared Zod schemas       → packages/contracts/README.md
│   └── tsconfig/           Strict TypeScript presets
├── docs/
│   ├── infrastructure.md   Tooling, CI, Docker, deployment
│   └── guides/             How to add endpoints, modules, components and features
├── .github/workflows/      One CI workflow per app, triggered only by its own paths
└── docker-compose.yml      PostgreSQL, API and web
```

## Documentation

| Read                                      | For                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [API](apps/api/README.md)                 | Layers, providers, validation, errors, logging, data model, endpoints, API tests                     |
| [Web](apps/web/README.md)                 | Rendering and hydration, state, data fetching, optimistic updates, styling, accessibility, web tests |
| [Contracts](packages/contracts/README.md) | Shared schemas and the rules for writing them                                                        |
| [Infrastructure](docs/infrastructure.md)  | Turborepo, CI, Docker images, deployment                                                             |
| [Authentication](docs/authentication.md)  | Sign-in, tokens, roles and permissions, and the path to a separate user service                      |
| [Guides](docs/guides/)                    | Step-by-step patterns for extending the project                                                      |

## Decisions and tradeoffs

I kept a service layer even where it is thin today, because it is the obvious home for rules the
spec does not define yet, such as restricting status transitions, and it lets business logic be
tested without a database. Any status can currently move to any other, including reopening a
closed ticket, since no workflow was specified. Pagination uses page numbers because the spec asks
for `page` and `limit` and a support queue benefits from "page 3 of 7", but offset pages can shift
while tickets arrive and get slower deep into a large table; with more data I would switch to
cursor pagination on `(created_at, id)`, which the existing index already supports. Status changes
in the UI are optimistic, and if two different rows change at once and the first fails, its
rollback briefly reverts the second row too until the follow-up refetch corrects it; I judged
per-row rollback not worth the complexity here. Dates are shown in UTC so server and client render
the same markup, where a real product would use each user's time zone. The API runs migrations
when the container starts because Render's free tier has no pre-deploy step; that makes the image
larger (the Prisma CLI ships with it) and gives the app's database user schema permissions, so
with more than one instance I would move migrations into the CI deploy job. Rendering the list on
the server makes the first paint complete but ties it to API latency, which matters on Render's
free tier where a sleeping service can take close to a minute to wake. `npm audit` reports two
advisories in packages pulled in by the Prisma CLI (`deepmerge-ts` and `mysql2`); neither is
reachable here, and the only automated fix is a downgrade to Prisma 6.

Assumptions where the brief was silent: new tickets default to `medium` priority and always start
`open`; ticket ids are integers because support teams quote them; invalid list query params are a
400 from the API but fall back to the default view in the UI, where they usually come from an old
or hand-edited link.

With more time I would add:

- Authentication, with per-user time zones and an assignee on tickets
- A ticket detail view with `GET /tickets/:id` and editable title and description
- Cursor pagination and full-text search
- ESLint with typescript-eslint, which Prettier and strict TypeScript only partly replace
- End-to-end tests with Playwright against the Compose stack
- An OpenAPI document generated from the contracts
- A hosted monitor such as Sentry behind the existing `Monitor` interface
- Migrations as a CI deploy step, which also removes the Prisma CLI from the API image

## Extending the project

The [guides](docs/guides/) describe the patterns used everywhere in the codebase:

- [Adding an API endpoint](docs/guides/adding-an-endpoint.md)
- [Adding an API module](docs/guides/adding-a-module.md)
- [Adding a web component](docs/guides/adding-a-component.md)
- [Adding a feature end to end](docs/guides/adding-a-feature.md)
