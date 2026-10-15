import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../generated/prisma/client.js";
import type { Logger } from "../logger/logger.interface.js";
import type { DatabaseProvider } from "./database.interface.js";

export class PrismaDatabaseProvider implements DatabaseProvider<PrismaClient> {
  readonly client: PrismaClient;

  constructor(
    connectionString: string,
    private readonly logger: Logger,
  ) {
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  async connect(): Promise<void> {
    await this.client.$connect();
    this.logger.info("Database connected");
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
    this.logger.info("Database disconnected");
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn("Database health check failed", { err: error });
      return false;
    }
  }
}
