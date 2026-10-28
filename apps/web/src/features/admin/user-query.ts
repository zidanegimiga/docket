import { DEFAULT_PAGE_SIZE, listUsersQuerySchema, type ListUsersQuery } from "@docket/contracts";

type SearchParams = Record<string, string | string[] | undefined>;

export const USERS_PATH = "/admin/users";
const DEFAULT_QUERY = listUsersQuerySchema.parse({});

export interface UserListView extends ListUsersQuery {
  /** The user open in the editor, if any. */
  selected: string | undefined;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the view from the URL; anything invalid falls back to the default list. */
export function parseUserListView(params: SearchParams): UserListView {
  const { user, ...rest } = params;
  const result = listUsersQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(rest).map(([key, value]) => [key, first(value) || undefined]),
    ),
  );
  return { ...(result.success ? result.data : DEFAULT_QUERY), selected: first(user) || undefined };
}

export function userListHref({
  status,
  search,
  page,
  limit,
  selected,
}: Partial<UserListView>): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  if (page && page > 1) params.set("page", String(page));
  if (limit && limit !== DEFAULT_PAGE_SIZE) params.set("limit", String(limit));
  if (selected) params.set("user", selected);

  const query = params.toString();
  return query ? `${USERS_PATH}?${query}` : USERS_PATH;
}
