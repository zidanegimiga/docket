import {
  DEFAULT_PAGE_SIZE,
  listTicketsQuerySchema,
  type ListTicketsQuery,
} from "@docket/contracts";

type SearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_QUERY = listTicketsQuerySchema.parse({});

export function parseListQuery(params: SearchParams): ListTicketsQuery {
  const firstValues = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const result = listTicketsQuerySchema.safeParse(firstValues);
  return result.success ? result.data : DEFAULT_QUERY;
}

export function listHref({ status, page, limit }: Partial<ListTicketsQuery>): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  if (limit && limit !== DEFAULT_PAGE_SIZE) params.set("limit", String(limit));

  const search = params.toString();
  return search ? `/?${search}` : "/";
}
