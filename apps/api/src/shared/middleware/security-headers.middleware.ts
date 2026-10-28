import type { RequestHandler } from "express";
import helmet from "helmet";

export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
  });
}
