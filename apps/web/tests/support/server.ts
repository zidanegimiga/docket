import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { makeUser } from "./fixtures";

const emptyStats = { total: 0, byStatus: { open: 0, in_progress: 0, closed: 0 } };

export const server = setupServer(
  http.get("/api/tickets/stats", () => HttpResponse.json(emptyStats)),
  // A signed-in user who may update any ticket; tests about permissions override it.
  http.get("/api/auth/me", () => HttpResponse.json({ user: makeUser() })),
);
