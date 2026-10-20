# Adding an API module

A module is a business capability with its own routes and, usually, its own data. `tickets` is
the reference implementation and `health` is the minimal one.

## Layout

```
apps/api/src/modules/<name>/
├── <name>.routes.ts       path → validation → controller method
├── <name>.controller.ts   HTTP in, HTTP out
├── <name>.service.ts      business rules, depends on the repository interface
├── <name>.repository.ts   Prisma queries only (omit if the module has no data)
├── <name>.schemas.ts      API-only schemas such as path params
├── <name>.types.ts        domain entity and repository interface
└── index.ts               create<Name>Module(deps): Router
```

Use singular names for files (`comment.service.ts`) and the plural for the URL (`/comments`).

## The module factory

`index.ts` wires the module's internals and exposes only a router. The composition root never
sees the module's classes.

```ts
export interface CommentModuleDeps {
  database: DatabaseProvider<PrismaClient>;
  monitor: Monitor;
}

export function createCommentModule({ database, monitor }: CommentModuleDeps): Router {
  const repository = new PrismaCommentRepository(database.client);
  const service = new CommentService(repository, monitor);
  const controller = new CommentController(service);

  return commentRoutes(controller);
}
```

Ask only for the dependencies the module uses. `health` takes a `DatabaseProvider<unknown>`
because it never touches the Prisma client.

## Steps

1. **Data model.** Add the model to `prisma/schema.prisma` with snake_case `@map` names, real
   enums for fixed value sets and indexes for the queries you plan to run. Create the migration
   with `npm run db:migrate -w @docket/api -- --name <change>` and commit the generated SQL
   unchanged.
2. **Contracts.** Add the shared schemas in `packages/contracts/src/<name>.ts` and export them
   from `index.ts`.
3. **Types and repository.** Define the entity and repository interface in `<name>.types.ts`, the
   Prisma implementation in `<name>.repository.ts`, and an in-memory fake in
   `tests/helpers/in-memory-<name>.repository.ts`.
4. **Service** with unit tests against the fake.
5. **Controller, routes and `index.ts`.**
6. **Register the module** in `src/routes.ts`. This is the only file that maps URL prefixes:

   ```ts
   router.use("/comments", createCommentModule({ database, monitor }));
   ```

   If the module needs a new provider, add it to `RouterDeps` and pass it from `container.ts`.

7. **Integration tests** in `tests/integration/<name>.<action>.test.ts`.

## Rules

- Modules never import from other modules. Shared code moves to `src/shared/`.
- Services depend on interfaces, never on Prisma, Express or Pino.
- Only `container.ts` constructs concrete providers.
- Errors are `AppError` subclasses from `src/shared/errors/`. Add a new subclass when a new status
  code or error code is needed, rather than throwing plain errors.
- If a module needs an external service (email, queue, storage), define an interface in
  `src/core/<concern>/`, add one implementation beside it and create it in `container.ts`, the
  same way `Logger`, `Monitor` and `DatabaseProvider` work.
