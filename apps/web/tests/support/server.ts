import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const emptyStats = { total: 0, byStatus: { open: 0, in_progress: 0, closed: 0 } };

export const server = setupServer(
  http.get("/api/tickets/stats", () => HttpResponse.json(emptyStats)),
);
