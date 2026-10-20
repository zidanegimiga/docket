# @docket/contracts

Zod schemas, and the types inferred from them, for every shape that crosses the network between
the [API](../../apps/api/README.md) and the [web app](../../apps/web/README.md).

Back to the [project README](../../README.md).

## Why it exists

Both apps import the same definitions:

- the API validates requests with them,
- the web app parses the API's responses with them,
- the API's integration tests parse every response with them.

A change to a shape is therefore a compile error or a failing test on both sides, never a silent
drift. The package is compiled to `dist/` so the API can import it at runtime without a TypeScript
loader; Turborepo builds it before anything that depends on it.

## Exports

| Export                                 | Used for                                                                |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `TICKET_STATUSES`, `TICKET_PRIORITIES` | Enum values, also used to render selects and filter tabs                |
| `ticketSchema`                         | A ticket as it travels over HTTP (dates as ISO strings)                 |
| `createTicketSchema`                   | POST body: trims the title, drops blank descriptions, defaults priority |
| `updateTicketSchema`                   | PATCH body: status and/or priority, at least one required               |
| `listTicketsQuerySchema`               | `status`, `page` and `limit`, coerced from query strings                |
| `ticketListSchema`                     | The `{ data, pagination }` list response                                |
| `ticketStatsSchema`                    | `{ total, byStatus }`, with every status required even at zero          |
| `pageQuerySchema`, `paginatedSchema()` | Pagination building blocks shared by any list endpoint                  |

## Rules for writing schemas

- **Bodies are strict** (`z.strictObject`), so unknown fields are rejected rather than ignored.
- **Query schemas are tolerant** (`z.object` with `z.coerce`), because query strings arrive as
  strings and proxies add their own params.
- **Export input and output types separately** when defaults or transforms make them differ.
  `CreateTicketInput` is what a form sends (priority optional); `CreateTicketBody` is what the API
  service receives (priority always set).
- **Put `.optional()` after `.transform()`.** In the other order the output type makes the key
  required with an `undefined` value.
- **Key records by enums** (`z.record(ticketStatusSchema, ...)`). Zod treats them as exhaustive,
  so adding a status forces every producer and consumer to handle it.
- **Describe the wire, not the database.** Dates are ISO strings here, even though the API works
  with `Date` objects internally.
- **Keep API-only schemas out.** Path params and similar live in the API module that uses them.

After editing, rebuild with `npx turbo run build --filter=@docket/contracts`, or let
`npm run dev` and `npm test` do it through Turborepo.
