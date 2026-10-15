import type { TicketPriority } from "@docket/contracts";

export const priorityLabels: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
