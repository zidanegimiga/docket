import { AppError } from "./app.error.js";

export class UnauthorizedError extends AppError {
  constructor(code = "UNAUTHORIZED", message = "Authentication is required") {
    super(401, code, message);
  }
}
