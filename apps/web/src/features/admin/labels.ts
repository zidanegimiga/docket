import type { UserStatus } from "@docket/contracts";

export const userStatusLabels: Record<UserStatus, string> = {
  pending: "Waiting for approval",
  active: "Active",
  disabled: "Disabled",
};

export const userStatusFilterLabels: Record<UserStatus, string> = {
  pending: "Pending",
  active: "Active",
  disabled: "Disabled",
};
