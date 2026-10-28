import type { Principal } from "../core/identity/principal.js";
import type { Logger } from "../core/logger/logger.interface.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
      /** Set by the authenticate middleware. */
      principal?: Principal;
    }
  }
}

export {};
