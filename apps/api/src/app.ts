import express, { type Express, type Router } from "express";

import type { Logger } from "./core/logger/logger.interface.js";
import type { Monitor } from "./core/monitoring/monitor.interface.js";
import { errorHandler } from "./shared/middleware/error-handler.middleware.js";
import { notFound } from "./shared/middleware/not-found.middleware.js";
import { requestContext } from "./shared/middleware/request-context.middleware.js";
import { requestLogger } from "./shared/middleware/request-logger.middleware.js";

export interface AppDeps {
  logger: Logger;
  monitor: Monitor;
  router: Router;
}

export function createApp({ logger, monitor, router }: AppDeps): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestContext(logger));
  app.use(requestLogger(monitor));
  app.use(express.json({ limit: "32kb" }));

  app.use(router);

  app.use(notFound);
  app.use(errorHandler(monitor));

  return app;
}
