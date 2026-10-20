import type { RequestHandler } from "express";

import { NotFoundError } from "../errors/not-found.error.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError("Route", `${req.method} ${req.path}`));
};
