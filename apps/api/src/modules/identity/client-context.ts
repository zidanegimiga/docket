import type { Request } from "express";

import type { ClientContext } from "./auth.service.js";

export function clientContext(req: Request): ClientContext {
  return { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}
