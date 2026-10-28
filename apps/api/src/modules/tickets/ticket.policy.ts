import type { Principal } from "../../core/identity/principal.js";

/** Which tickets a caller may update: all of them, only their own, or none. */
export type TicketUpdateScope = { kind: "any" } | { kind: "own"; creatorId: string } | null;

export function ticketUpdateScope({ userId, permissions }: Principal): TicketUpdateScope {
  if (permissions.includes("tickets:update:any")) return { kind: "any" };
  if (permissions.includes("tickets:update:own")) return { kind: "own", creatorId: userId };
  return null;
}
