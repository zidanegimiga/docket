import type { RequestHandler } from "express";
import type { ParsedQs } from "qs";
import type { z, ZodType } from "zod";

import { ValidationError, type ValidationIssue } from "../errors/validation.error.js";

export interface RequestSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

type Parsed<Schema, Fallback> = Schema extends ZodType ? z.output<Schema> : Fallback;

export type ValidatedHandler<Schemas extends RequestSchemas> = RequestHandler<
  Parsed<Schemas["params"], Record<string, string>>,
  unknown,
  Parsed<Schemas["body"], unknown>,
  Parsed<Schemas["query"], ParsedQs>
>;

const PARTS = ["params", "query", "body"] as const;

export function validate<Schemas extends RequestSchemas>(
  schemas: Schemas,
): ValidatedHandler<Schemas> {
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
    if ("body" in parsed) req.body = parsed.body as typeof req.body;
    // Express 5 exposes req.query as a getter, so the parsed value is defined on the instance.
    if ("query" in parsed) Object.defineProperty(req, "query", { value: parsed.query });

    next();
  };
}
