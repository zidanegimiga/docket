import { z } from "zod";

import { permissionSchema } from "./permissions.js";

export const USER_STATUSES = ["pending", "active", "disabled"] as const;

export const userStatusSchema = z.enum(USER_STATUSES);

export type UserStatus = z.infer<typeof userStatusSchema>;

export const EMAIL_MAX_LENGTH = 254;
export const NAME_MAX_LENGTH = 100;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(EMAIL_MAX_LENGTH));

export const signUpSchema = z.strictObject({
  email: emailSchema,
  name: z.string().trim().min(1, "Name is required").max(NAME_MAX_LENGTH),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH),
});

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignUpBody = z.output<typeof signUpSchema>;

export const logInSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(PASSWORD_MAX_LENGTH),
});

export type LogInInput = z.input<typeof logInSchema>;
export type LogInBody = z.output<typeof logInSchema>;

export const providerIdSchema = z.string().regex(/^[a-z0-9-]+$/);

export const currentUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  status: userStatusSchema,
  permissions: z.array(permissionSchema),
  providers: z.array(providerIdSchema),
  hasPassword: z.boolean(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

export const authProvidersSchema = z.object({
  providers: z.array(z.object({ id: providerIdSchema, name: z.string() })),
});

export type AuthProviders = z.infer<typeof authProvidersSchema>;
