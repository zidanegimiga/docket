# AGENTS.md

Working notes for anyone changing this repository, coding agents included. The READMEs explain
how the system works; this file lists what to run, where code goes, and the rules that are easy to
break without noticing. Each app has its own `AGENTS.md` with the details for that app.

## Commands

Node 22 and npm 11. Run everything from the repository root.

```bash
npm install
docker compose up -d db                      # PostgreSQL on localhost:5432
cp apps/api/.env.example apps/api/.env
npm run db:deploy -w @docket/api             # apply migrations
npm run dev                                  # API on :4000, web on :3000
```

Before calling any change finished, run:

```bash
npm run check                                # format:check, typecheck and every test
```

Narrower loops while working:

| Need                                      | Command                                                         |
| ----------------------------------------- | --------------------------------------------------------------- |
| One API test file                         | `npm test -w @docket/api -- tests/integration/auth.me.test.ts`  |
| API unit tests only (no database)         | `npm run test:unit -w @docket/api`                              |
| One web test file                         | `npm test -w @docket/web -- tests/component/LoginForm.test.tsx` |
| Fix formatting                            | `npm run format`                                                |
| Production build (catches Next.js issues) | `npm run build`                                                 |

API integration tests need the database container. They use a separate `docket_test` database
that the test setup migrates on every run, so they never touch development data.

## Where things live

```
apps/api/src/core/        Interfaces and providers: config, database, logger, monitor, identity, email
apps/api/src/shared/      Errors, middleware (authenticate, permission guards, validate) and HTTP helpers
apps/api/src/modules/     One folder per capability: tickets, identity (auth and admin), health
apps/api/src/container.ts The composition root: the only place concrete providers are created
apps/web/src/app/         Next.js routes: (app) needs a session, (auth) holds login and sign-up
apps/web/src/features/    One folder per feature: api/, hooks/, components/
apps/web/src/shared/      HTTP client, session refresh, UI primitives, styles
packages/contracts/       Zod schemas and types shared by both apps, plus the permission catalog
docs/                     Design notes and step-by-step guides
```

## Rules that hold everywhere

- **The contract comes first.** Any shape that crosses the network is a Zod schema in
  `packages/contracts`. The API validates requests with it, the web app parses responses with it,
  and tests parse every response with it. Never hand-write a duplicate type in an app.
- **Deny by default.** Every API route except `/health`, `/auth/*` and `/.well-known/*` sits behind
  `authenticate` and names the permission it needs with `requirePermission`. Check permissions,
  never role names. New permissions go in `packages/contracts/src/permissions.ts` and need a
  migration that grants them to the `admin` role (a test fails until it exists).
- **The UI hides, the API decides.** Web permission checks (`can`, `RequirePermission`) only hide
  controls. They must mirror the API rule, which stays the source of truth.
- **Dependencies point inwards.** Services depend on interfaces, never on Express, Prisma or Pino.
  Modules never import from other modules; shared code moves to `shared/` or `core/`.
- **Secrets stay out of the repo.** Use `.env` files (ignored) and host settings. Never log tokens,
  passwords, password hashes or full URLs with credentials in the query string.
- **Generated code is not edited.** `apps/api/src/generated/` comes from `prisma generate`.

## Conventions

- TypeScript is strict everywhere. No `any` without a comment explaining why.
- Prettier formats everything: double quotes, 100 columns. Run `npm run format`, do not hand-format.
- File names describe their role: `ticket.service.ts`, `ticket.repository.ts`, `TicketTable.tsx`
  with `TicketTable.module.css` beside it.
- Comments explain why, not what. Match the density of the surrounding code.
- Tests live in each app's `tests/` folder, split into `unit`, `integration` (API) or `component`
  (web). A new behaviour gets a test, and the test should be seen failing when the behaviour is
  broken.
- Commit messages follow Conventional Commits (`feat(api): ...`, `fix(web): ...`,
  `test(api): ...`) and each commit leaves the build green.

## Gotchas

- **Prisma.** After editing `prisma/schema.prisma`, create a migration with
  `npm run db:migrate -w @docket/api -- --name <change>`, then run
  `npm run db:generate -w @docket/api`; `migrate dev` does not regenerate the client in Prisma 7.
- **Contracts are consumed from `dist/`.** Turbo builds them before typecheck, test and build. If
  you run a workspace's tools directly after changing contracts, run
  `npm run build -w @docket/contracts` first.
- **Cookie requests need an Origin.** The API rejects state-changing requests that carry cookies
  without a matching `Origin` or `Sec-Fetch-Site`. In API tests use bearer headers from the
  `signIn` helper, or set `Origin: TEST_WEB_ORIGIN` on agents that log in with cookies.
- **Moving or adding Next.js route folders** sometimes leaves a running `next dev` serving stale
  layouts. Restart it before debugging what looks like a rendering bug.
- **Dates render in UTC** on purpose, so server and client markup match. Use
  `shared/format/date.ts`; never format with the browser's locale during render.

## Documentation

| Read                                                                               | When                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| [apps/api/AGENTS.md](apps/api/AGENTS.md)                                           | Changing the API                               |
| [apps/web/AGENTS.md](apps/web/AGENTS.md)                                           | Changing the web app                           |
| [docs/authentication.md](docs/authentication.md)                                   | Anything touching sign-in, sessions or access  |
| [docs/guides/](docs/guides/)                                                       | Adding an endpoint, module, component, feature |
| [apps/api/README.md](apps/api/README.md), [apps/web/README.md](apps/web/README.md) | Deeper explanations of each app                |
| [docs/infrastructure.md](docs/infrastructure.md)                                   | CI, Docker and deployment                      |
