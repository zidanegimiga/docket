import type { DatabaseProvider } from "../../src/core/database/database.interface.js";

export class FakeDatabase implements DatabaseProvider<null> {
  readonly client = null;
  healthy = true;

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async healthCheck(): Promise<boolean> {
    return this.healthy;
  }
}
