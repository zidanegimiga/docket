import type { CurrentUser, Permission, Ticket } from "@docket/contracts";

export function can(user: CurrentUser | undefined, permission: Permission): boolean {
  return user?.status === "active" && user.permissions.includes(permission);
}

/** Mirrors the API's rule: any ticket with tickets:update:any, otherwise only one's own. */
export function canUpdateTicket(
  user: CurrentUser | undefined,
  ticket: Pick<Ticket, "createdById">,
): boolean {
  if (can(user, "tickets:update:any")) return true;
  return can(user, "tickets:update:own") && ticket.createdById === user?.id;
}
