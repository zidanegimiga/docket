import type { Server } from "node:http";

import { createContainer } from "./container.js";
import { loadEnv } from "./core/config/env.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function main(): Promise<void> {
  const env = loadEnv();
  const { app, database, logger } = createContainer(env);

  await database.connect();

  const server = app.listen(env.PORT, () => {
    logger.info("Server listening", { port: env.PORT, nodeEnv: env.NODE_ENV });
  });

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down", { signal });

    const forceExit = setTimeout(() => {
      logger.error("Shutdown timed out, forcing exit", { timeoutMs: SHUTDOWN_TIMEOUT_MS });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await closeServer(server);
      await database.disconnect();
      logger.info("Shutdown complete");
    } catch (error) {
      logger.error("Shutdown failed", { err: error });
      process.exitCode = 1;
    }
  };

  process.once("SIGTERM", (signal) => void shutdown(signal));
  process.once("SIGINT", (signal) => void shutdown(signal));
}

main().catch((error: unknown) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
