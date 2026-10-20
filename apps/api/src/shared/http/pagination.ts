import type { Pagination } from "@docket/contracts";

export interface Paginated<Item> {
  data: Item[];
  pagination: Pagination;
}

export function paginate<Item>(
  items: Item[],
  total: number,
  { page, limit }: { page: number; limit: number },
): Paginated<Item> {
  return {
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
