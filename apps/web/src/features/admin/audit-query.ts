import { DEFAULT_PAGE_SIZE, listAuditQuerySchema, type ListAuditQuery } from "@docket/contracts";

type SearchParams = Record<string, string | string[] | undefined>;

export const AUDIT_PATH = "/admin/audit";
const DEFAULT_QUERY = listAuditQuerySchema.parse({});

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the view from the URL; anything invalid falls back to the whole log. */
export function parseAuditQuery(params: SearchParams): ListAuditQuery {
  const result = listAuditQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, first(value) || undefined]),
    ),
  );
  return result.success ? result.data : DEFAULT_QUERY;
}

export function auditHref({ action, targetId, page, limit }: Partial<ListAuditQuery>): string {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (targetId) params.set("targetId", targetId);
  if (page && page > 1) params.set("page", String(page));
  if (limit && limit !== DEFAULT_PAGE_SIZE) params.set("limit", String(limit));

  const query = params.toString();
  return query ? `${AUDIT_PATH}?${query}` : AUDIT_PATH;
}
