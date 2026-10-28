"use client";

import type { Permission } from "@docket/contracts";
import type { ReactNode } from "react";

import { useCurrentUser } from "../../hooks/useCurrentUser";
import { can } from "../../permissions";

interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
}

/** Hides controls the API would refuse. The API still checks every request. */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { data: user } = useCurrentUser();
  return can(user, permission) ? children : null;
}
