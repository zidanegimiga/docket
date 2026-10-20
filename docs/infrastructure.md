# Infrastructure

Tooling, CI, Docker images and deployment. Back to the [project README](../README.md).

## Monorepo and Turborepo

npm workspaces hold two apps (`apps/api`, `apps/web`) and two packages (`packages/contracts`,
`packages/tsconfig`). Turborepo runs tasks in dependency order and caches them.

| Task          | Depends on                                       |
| ------------- | ------------------------------------------------ |
| `build`       | Dependencies built, Prisma client generated      |
| `typecheck`   | Dependencies built, Prisma client generated      |
| `test`        | Dependencies built, Prisma client generated      |
| `dev`         | Dependencies built, Prisma client generated      |
| `db:generate` | Cached on `schema.prisma` and `prisma.config.ts` |

A fresh clone therefore works with one command. Turborepo 2 runs in strict environment mode and
only passes declared variables to tasks: `API_URL` is declared as a build input (the web build
bakes it into the `/api` rewrite, and the cache keys on it), and `NEXT_TELEMETRY_DISABLED` is
passed through without affecting the hash.

## Code quality

- TypeScript is strict everywhere, with `noUncheckedIndexedAccess`, `noImplicitOverride` and
  `verbatimModuleSyntax`, from shared presets in `packages/tsconfig`. Tests are type-checked too.
- Prettier with one shared config. Generated code and migrations are excluded so tool-owned files
  stay byte for byte.
- `.vscode/` sets Prettier as the formatter, formats on save and uses the workspace TypeScript.
- Commits follow Conventional Commits with a scope per area: `api`, `web`, `contracts`, `db`,
  `repo`, `config`, `ci`, `docs`.

## Continuous integration

GitHub Actions has one workflow per app, each triggered only by changes to that app,
`packages/`, root config or the workflow file itself. A frontend change never runs the API
pipeline and the reverse.

| Workflow  | Runs                                                                    | Services                |
| --------- | ----------------------------------------------------------------------- | ----------------------- |
| `api.yml` | Prettier, then `turbo run typecheck test --filter=@docket/api...`       | PostgreSQL 16 container |
| `web.yml` | Prettier, then `turbo run typecheck test build --filter=@docket/web...` | none, the API is mocked |

The trailing `...` includes the packages each app depends on, so a contract change is checked by
both. Superseded runs on the same branch are cancelled and jobs time out after ten minutes.

## Docker images

Both apps have multi-stage Dockerfiles built from the repository root:

1. `turbo prune` reduces the monorepo to the app and the packages it depends on.
2. A builder stage installs everything and runs the Turborepo build.
3. A runtime stage keeps only what the process needs, runs as the unprivileged `node` user and
   defines a health check.

| Image | Runtime contents                                         | Start command                                            |
| ----- | -------------------------------------------------------- | -------------------------------------------------------- |
| API   | Production dependencies, compiled output, migrations     | `prisma migrate deploy`, then `exec node dist/server.js` |
| Web   | Next.js standalone output (traced files only) and assets | `node apps/web/server.js`                                |

`exec` lets SIGTERM reach Node so the API's graceful shutdown runs in containers. The Next.js
standalone server has no shutdown handler of its own and stops immediately, which is acceptable
for a stateless renderer.

```bash
docker build -f apps/api/Dockerfile -t docket-api .
docker build -f apps/web/Dockerfile --build-arg API_URL=https://api.example.com -t docket-web .
```

`docker compose up --build` runs both with PostgreSQL. The API waits for a healthy database and
the web app waits for a healthy API, reaching it over the Compose network at `http://api:4000`.
Host ports come from `.env` (see `.env.example`).

The API image is the larger of the two (around 880MB uncompressed) because the Prisma CLI ships
with it to run migrations at startup. Images are only built in CI or on the hosting platform; local
development needs nothing beyond `docker compose up -d db`.

## Deployment

All on free tiers:

| Part     | Platform | Notes                                                                   |
| -------- | -------- | ----------------------------------------------------------------------- |
| Database | Neon     | Render's free Postgres expires after 30 days; Neon's free tier does not |
| API      | Render   | Built from `apps/api/Dockerfile`, health checked on `/health`           |
| Web      | Vercel   | `API_URL` must be set before building, since the rewrite is baked in    |

Render's free web services sleep after 15 minutes without traffic, and the first request after
that can take close to a minute while the service wakes.
