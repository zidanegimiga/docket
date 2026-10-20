import type { Logger } from "../core/logger/logger.interface.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
    }
  }
}

export {};
