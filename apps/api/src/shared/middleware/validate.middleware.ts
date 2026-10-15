import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { ValidationError, type ValidationIssue } from "../errors/validation.error.js";

export interface RequestSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

const PARTS = ["params", "query", "body"] as const;

export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const issues: ValidationIssue[] = [];
    const parsed: Partial<Record<keyof RequestSchemas, unknown>> = {};

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (result.success) {
        parsed[part] = result.data;
      } else {
        issues.push(
          ...result.error.issues.map((issue) => ({
            path: [part, ...issue.path.map(String)].join("."),
            message: issue.message,
          })),
        );
      }
    }

    if (issues.length > 0) {
      next(new ValidationError(issues));
      return;
    }

    if ("params" in parsed) req.params = parsed.params as typeof req.params;
    if ("body" in parsed) req.body = parsed.body;
    // Express 5 exposes req.query as a getter, so the parsed value is defined on the instance.
    if ("query" in parsed) Object.defineProperty(req, "query", { value: parsed.query });

    next();
  };
}
