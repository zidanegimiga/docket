import { AppError } from "./app.error.js";

/** The request is valid but would leave data in a state the rules forbid. */
export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}
