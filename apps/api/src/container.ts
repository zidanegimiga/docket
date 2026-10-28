import type { Express } from "express";

import { createApp } from "./app.js";
import type { Env } from "./core/config/env.js";
import type { DatabaseProvider } from "./core/database/database.interface.js";
import { PrismaDatabaseProvider } from "./core/database/prisma.database.js";
import { createIdentity, type Identity, type IdentityOverrides } from "./core/identity/identity.js";
import type { Logger } from "./core/logger/logger.interface.js";
import { PinoLogger } from "./core/logger/pino.logger.js";
import { LoggerMonitor } from "./core/monitoring/logger.monitor.js";
import type { Monitor } from "./core/monitoring/monitor.interface.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { createRouter } from "./routes.js";

export interface Container {
  env: Env;
  logger: Logger;
  monitor: Monitor;
  database: DatabaseProvider<PrismaClient>;
  identity: Identity;
  app: Express;
}

export async function createContainer(
  env: Env,
  overrides: IdentityOverrides = {},
): Promise<Container> {
  const logger = PinoLogger.create({
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV === "development",
  });
  const monitor = new LoggerMonitor(logger);
  const database = new PrismaDatabaseProvider(env.DATABASE_URL, logger);
  const identity = await createIdentity(env, logger.child({ component: "identity" }), overrides);

  const app = createApp({
    logger,
    monitor,
    router: createRouter({
      database,
      monitor,
      identity,
      logger,
      cookies: {
        secure: new URL(env.WEB_ORIGIN).protocol === "https:",
        apiPrefix: env.PUBLIC_API_PREFIX,
      },
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    }),
    trustProxyHops: env.TRUST_PROXY_HOPS,
  });

  return { env, logger, monitor, database, identity, app };
}
