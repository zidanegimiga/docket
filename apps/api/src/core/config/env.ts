import { z } from "zod";

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const httpUrl = z.url({ protocol: /^https?$/, error: "must be an http or https URL" });

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

    WEB_ORIGIN: httpUrl.transform((url) => new URL(url).origin).default("http://localhost:3000"),
    PUBLIC_API_PREFIX: z
      .string()
      .regex(/^(\/[a-z0-9-]+)*$/, "must be empty or a path like /api")
      .default("/api"),
    AUTH_PRIVATE_KEY: optionalSecret,
    AUTH_ALLOW_EPHEMERAL_KEY: z.stringbool().default(false),
    AUTH_ISSUER: httpUrl.default("http://localhost:4000"),
    AUTH_AUDIENCE: z.string().min(1).default("docket-api"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(120).default(30),

    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,
  })
  .superRefine((env, context) => {
    const ephemeralKeyAllowed = env.NODE_ENV !== "production" || env.AUTH_ALLOW_EPHEMERAL_KEY;
    if (!env.AUTH_PRIVATE_KEY && !ephemeralKeyAllowed) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_PRIVATE_KEY"],
        message: "is required in production; generate one with `npm run auth:keys -w @docket/api`",
      });
    }

    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message: "and GOOGLE_CLIENT_SECRET must be set together",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
