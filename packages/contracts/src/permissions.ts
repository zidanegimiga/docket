import { z } from "zod";

export const PERMISSIONS = [
  "tickets:read",
  "tickets:create",
  "tickets:update:own",
  "tickets:update:any",
  "users:read",
  "users:manage",
  "roles:manage",
  "audit:read",
] as const;

export const permissionSchema = z.enum(PERMISSIONS);

export type Permission = z.infer<typeof permissionSchema>;

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "tickets:read": "View tickets and ticket counts",
  "tickets:create": "Create tickets",
  "tickets:update:own": "Change status and priority of tickets they created",
  "tickets:update:any": "Change status and priority of any ticket",
  "users:read": "View users, their roles and their permissions",
  "users:manage": "Approve, disable and assign roles or permissions to users",
  "roles:manage": "Create, edit and delete roles",
  "audit:read": "View the audit log of administrative changes",
};
