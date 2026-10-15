import { AppError } from "./app.error.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationError extends AppError {
  constructor(issues: ValidationIssue[]) {
    super(400, "VALIDATION_FAILED", "Request validation failed", issues);
  }
}
