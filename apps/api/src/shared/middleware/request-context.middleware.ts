import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

import type { Logger } from "../../core/logger/logger.interface.js";

const REQUEST_ID_HEADER = "x-request-id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get(REQUEST_ID_HEADER);
    const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

    req.id = id;
    req.log = logger.child({ requestId: id });
    res.setHeader(REQUEST_ID_HEADER, id);

    next();
  };
}
