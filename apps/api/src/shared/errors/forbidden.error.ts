import { AppError } from "./app.error.js";

export class ForbiddenError extends AppError {
  constructor(code = "FORBIDDEN", message = "You do not have permission to do this") {
    super(403, code, message);
  }
}
