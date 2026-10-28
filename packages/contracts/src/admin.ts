import { z } from "zod";

import { providerIdSchema, userStatusSchema } from "./auth.js";
import { pageQuerySchema, paginatedSchema } from "./pagination.js";
import { PERMISSIONS, permissionSchema } from "./permissions.js";

export const ROLE_NAME_MAX_LENGTH = 50;
export const ROLE_DESCRIPTION_MAX_LENGTH = 200;
export const USER_SEARCH_MAX_LENGTH = 100;
export const MAX_ROLES_PER_USER = 20;

const uniquePermissions = z
  .array(permissionSchema)
  .max(PERMISSIONS.length)
  .transform((permissions) => [...new Set(permissions)]);

const atLeastOneField = (data: object) => Object.values(data).some((value) => value !== undefined);

export const roleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.array(permissionSchema),
  isSystem: z.boolean(),
  userCount: z.number().int().min(0),
});

export type Role = z.infer<typeof roleSchema>;

export const roleListSchema = z.object({ data: z.array(roleSchema) });

export type RoleList = z.infer<typeof roleListSchema>;

const roleNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(ROLE_NAME_MAX_LENGTH)
  .regex(/^[A-Za-z0-9 _-]+$/, "Use letters, numbers, spaces, hyphens or underscores");

const roleDescriptionSchema = z
  .string()
  .trim()
  .max(ROLE_DESCRIPTION_MAX_LENGTH)
  .transform((value) => value || null);

export const createRoleSchema = z.strictObject({
  name: roleNameSchema,
  description: roleDescriptionSchema.optional(),
  permissions: uniquePermissions,
});

export type CreateRoleInput = z.input<typeof createRoleSchema>;
export type CreateRoleBody = z.output<typeof createRoleSchema>;

export const updateRoleSchema = z
  .strictObject({
    name: roleNameSchema.optional(),
    description: roleDescriptionSchema.optional(),
    permissions: uniquePermissions.optional(),
  })
  .refine(atLeastOneField, { message: "Provide at least one field to update" });

export type UpdateRoleInput = z.input<typeof updateRoleSchema>;
export type UpdateRoleBody = z.output<typeof updateRoleSchema>;

export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  status: userStatusSchema,
  roles: z.array(z.object({ id: z.uuid(), name: z.string() })),
  directPermissions: z.array(permissionSchema),
  effectivePermissions: z.array(permissionSchema),
  providers: z.array(providerIdSchema),
  hasPassword: z.boolean(),
  createdAt: z.iso.datetime(),
  lastLoginAt: z.iso.datetime().nullable(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

export const listUsersQuerySchema = pageQuerySchema.extend({
  status: userStatusSchema.optional(),
  search: z.string().trim().min(1).max(USER_SEARCH_MAX_LENGTH).optional(),
});

export type ListUsersInput = z.input<typeof listUsersQuerySchema>;
export type ListUsersQuery = z.output<typeof listUsersQuerySchema>;

export const userListSchema = paginatedSchema(adminUserSchema);

export type UserList = z.infer<typeof userListSchema>;

export const updateUserSchema = z
  .strictObject({
    status: userStatusSchema.optional(),
    roleIds: z
      .array(z.uuid())
      .max(MAX_ROLES_PER_USER)
      .transform((ids) => [...new Set(ids)])
      .optional(),
    directPermissions: uniquePermissions.optional(),
  })
  .refine(atLeastOneField, { message: "Provide at least one field to update" });

export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type UpdateUserBody = z.output<typeof updateUserSchema>;
