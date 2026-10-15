import type { DatabaseProvider } from "../../core/database/database.interface.js";

export interface HealthStatus {
  status: "ok" | "degraded";
  checks: {
    database: "up" | "down";
  };
}

export class HealthService {
  constructor(private readonly database: DatabaseProvider<unknown>) {}

  async check(): Promise<HealthStatus> {
    const databaseUp = await this.database.healthCheck();

    return {
      status: databaseUp ? "ok" : "degraded",
      checks: {
        database: databaseUp ? "up" : "down",
      },
    };
  }
}
