import type { ListAuditQuery } from "@docket/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { auditLogQuery } from "../api/admin.queries";

export function useAuditLog(query: ListAuditQuery) {
  return useQuery({ ...auditLogQuery(query), placeholderData: keepPreviousData });
}
