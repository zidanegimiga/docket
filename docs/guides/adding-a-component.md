# Adding a web component

## Where it goes

| The component...                                  | Goes in                                              |
| ------------------------------------------------- | ---------------------------------------------------- |
| Knows nothing about a feature (a button, a pager) | `apps/web/src/shared/components/<Name>/`             |
| Shows or edits a feature's data (a ticket table)  | `apps/web/src/features/<feature>/components/<Name>/` |

Shared components never import from `features/`. Feature components may import shared ones.

## Files

Every component is a folder with three files:

```
TicketTable/
├── TicketTable.tsx          the component
├── TicketTable.module.css   its styles, and only its styles
└── index.ts                 export { TicketTable } from "./TicketTable";
```

Import through the folder: `import { TicketTable } from "../TicketTable";`.

## Writing the component

- **Presentational by default.** Take data and callbacks as props. Leave fetching, URL parsing and
  mutations to a container component or a hook. `TicketTable` renders tickets; `TicketList` owns
  the query, the filter and the pager.
- **Server unless it must be client.** Add `"use client"` only when the component uses state,
  effects, event handlers or hooks such as `useQuery`. A server component can render client
  children.
- **Extend native props** for anything wrapping an HTML element, and spread the rest, so `name`,
  `required` and `onChange` work without being listed:

  ```tsx
  interface ButtonProps extends ComponentProps<"button"> {
    variant?: "primary" | "secondary";
    busy?: boolean;
  }
  ```

- **Form controls go through `Field`**, which renders the label, hint and error and wires
  `aria-describedby`. Use `useId()` for ids.
- **Enum values come from the contracts** (`TICKET_STATUSES`) with display text from the feature's
  `labels.ts`, so new values appear automatically.
- **Read server data from the query cache**, not local state, when it can change elsewhere. That
  is how optimistic updates and rollbacks show up with no extra code.

## Styling

- Use the tokens in `src/shared/styles/tokens.css` (`var(--space-3)`, `var(--color-text-muted)`)
  rather than raw values, so dark mode works automatically.
- Drive variants with data attributes (`data-status="closed"`) and target them in CSS rather than
  building class names from values.
- Reuse shared control styles with `composes: control from "../Field/Field.module.css";`.
- Keep to the established look: system fonts, 1px borders, small radii, no shadows, no icon set,
  colour never as the only signal.

## Accessibility

- Every control has a visible label or an `aria-label` that names what it acts on ("Status for
  ticket #11").
- Mark invalid fields with `aria-invalid` and announce outcomes with `role="status"` or
  `role="alert"`.
- Keep real text between visual pieces of a name. A CSS gap alone made "Open 6" read as "Open6".

## Tests

Add `apps/web/tests/component/<Name>.test.tsx`:

- Render with `renderWithClient` when the component (or a child) uses TanStack Query.
- Query by role and accessible name, never by class or test id.
- Mock the network with MSW handlers (`server.use(...)`), not the fetch function or the hooks.
- Mock `next/navigation` only when the component reads search params.
- Assert behaviour the user sees: text, values, disabled states, announced errors.
