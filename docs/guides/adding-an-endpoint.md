# Adding an API endpoint

Use this when an existing module (for example `tickets`) needs a new route. For a new business
capability with its own data, see [Adding an API module](adding-a-module.md).

## The shape of an endpoint

A request passes through the same layers every time:

```
route ─► validate(schemas) ─► controller ─► service ─► repository ─► Prisma
                                    │            │
                                    │            └─ throws AppError subclasses for business failures
                                    └─ reads typed req.params / req.query / req.body, sends the response
```

Each layer has one job, and a layer only talks to the one below it.

## Steps

Work bottom-up so every commit compiles. One step per commit.

### 1. Contract (if the shape crosses the network)

If the web app sends or reads the data, describe it in `packages/contracts/src/<feature>.ts` and
export the types:

```ts
export const updateTicketSchema = z
  .strictObject({
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
  })
  .refine((data) => data.status !== undefined || data.priority !== undefined, {
    message: "Provide a status or a priority to update",
  });

export type UpdateTicketBody = z.infer<typeof updateTicketSchema>;
```

- Bodies use `z.strictObject` so unknown fields are rejected.
- Query schemas use `z.object` with `z.coerce` so query strings become numbers and unknown params
  are dropped.
- Export `z.input` and `z.output` types separately when defaults or transforms make them differ.

Schemas used only by the API, such as path params, go in `apps/api/src/modules/<module>/<module>.schemas.ts`.

### 2. Repository

Add the method to the interface in `<module>.types.ts`, then implement it in
`<module>.repository.ts` and in the in-memory fake in `tests/helpers/`. All three change in the
same commit, otherwise the build breaks.

- Map fields explicitly. Never spread request input into Prisma `data`.
- Build optional filters with conditional spreads (`...(status && { status })`) instead of relying
  on Prisma ignoring `undefined`.
- Report "not found" as `null`, not as an error. Translate only the specific Prisma error code you
  expect and rethrow everything else.

### 3. Service

Add the method to `<module>.service.ts` with unit tests in `tests/unit/`.

- Business decisions live here: `throw new NotFoundError("Ticket", id)` when the repository
  returns `null`, defaults the database does not own, computed fields.
- Record business metrics here through the `Monitor`, tagged with low-cardinality values only.

### 4. Controller and route

```ts
// <module>.controller.ts
update: RequestHandler<TicketIdParams, unknown, UpdateTicketBody> = async (req, res) => {
  const ticket = await this.service.update(req.params.id, req.body);
  res.json(ticket);
};
```

```ts
// <module>.routes.ts
router.patch(
  "/:id",
  validate({ params: ticketIdParamsSchema, body: updateTicketSchema }),
  controller.update,
);
```

- Controller methods are arrow properties so they can be passed to the router without `bind`.
- No try/catch. Express 5 forwards rejected promises to the error handler.
- `validate()` infers the request types from the schemas, so the controller's generics must match
  the route's schemas or the file does not compile.
- Register fixed paths (`/stats`) before parameter paths (`/:id`).

### 5. Integration tests

Add `tests/integration/<module>.<action>.test.ts`:

- Build the app with `createTestContainer()` and reset the database in `beforeEach`.
- Seed with `seedTickets` (or a similar helper) to control timestamps and statuses.
- Parse every successful response with the contract schema.
- For every rejected request, also assert that the stored data did not change.

## Checklist

- [ ] Contract schema and types exported from `packages/contracts`
- [ ] Repository interface, Prisma implementation and fake updated together
- [ ] Service method with unit tests for each business rule
- [ ] Controller generics match the route's validation schemas
- [ ] Integration tests for success, 4xx cases and unchanged data on rejection
- [ ] `npm run typecheck`, `npm test` and `npm run format:check` pass
