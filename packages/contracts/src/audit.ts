import { z } from "zod";

import { userStatusSchema } from "./auth.js";
import { pageQuerySchema, paginatedSchema } from "./pagination.js";
import { permissionSchema } from "./permissions.js";

/** Added and removed items, for changes to a set such as a user's roles. */
const setChangeSchema = <Item extends z.ZodType>(item: Item) =>
  z.object({ added: z.array(item), removed: z.array(item) });

const valueChangeSchema = <Value extends z.ZodType>(value: Value) =>
  z.object({ from: value, to: value });

/** Each action with exactly the details it records. */
export const auditChangeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("user.status_changed"),
    changes: valueChangeSchema(userStatusSchema),
  }),
  z.object({ action: z.literal("user.roles_changed"), changes: setChangeSchema(z.string()) }),
  z.object({
    action: z.literal("user.permissions_changed"),
    changes: setChangeSchema(permissionSchema),
  }),
  z.object({ action: z.literal("user.promoted"), changes: z.object({}) }),
  z.object({
    action: z.literal("role.created"),
    changes: z.object({ permissions: z.array(permissionSchema) }),
  }),
  z.object({
    action: z.literal("role.updated"),
    changes: z.object({
      name: valueChangeSchema(z.string()).optional(),
      description: valueChangeSchema(z.string().nullable()).optional(),
      permissions: setChangeSchema(permissionSchema).optional(),
    }),
  }),
  z.object({
    action: z.literal("role.deleted"),
    changes: z.object({ permissions: z.array(permissionSchema) }),
  }),
]);

export type AuditChange = z.infer<typeof auditChangeSchema>;
export type AuditAction = AuditChange["action"];

export const AUDIT_ACTIONS = auditChangeSchema.options.map(
  (option) => option.shape.action.value,
) as AuditAction[];

export const auditEventSchema = z.intersection(
  z.object({
    id: z.uuid(),
    occurredAt: z.iso.datetime(),
    /** Null when the change came from the command line rather than a signed-in person. */
    actor: z.object({ id: z.uuid(), label: z.string() }).nullable(),
    target: z.object({ type: z.enum(["user", "role"]), id: z.uuid(), label: z.string() }),
    /** Links the entry to the API's logs for the same request. */
    requestId: z.string().nullable(),
  }),
  auditChangeSchema,
);

export type AuditEvent = z.infer<typeof auditEventSchema>;

export const listAuditQuerySchema = pageQuerySchema.extend({
  action: z.enum(AUDIT_ACTIONS as [AuditAction, ...AuditAction[]]).optional(),
  targetId: z.uuid().optional(),
});

export type ListAuditInput = z.input<typeof listAuditQuerySchema>;
export type ListAuditQuery = z.output<typeof listAuditQuerySchema>;

export const auditListSchema = paginatedSchema(auditEventSchema);

export type AuditList = z.infer<typeof auditListSchema>;
