import { AppError } from "./app.error.js";

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super(404, "NOT_FOUND", `${resource} ${id} was not found`);
  }
}
