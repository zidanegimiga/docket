import { TICKET_STATUSES, type TicketStats, type TicketStatus } from "@docket/contracts";

import { FilterTabs } from "@/shared/components/FilterTabs";

import { listHref } from "../../list-query";
import { statusLabels } from "../../labels";

interface StatusFilterProps {
  current: TicketStatus | undefined;
  limit: number;
  stats?: TicketStats | undefined;
}

const options: { value: TicketStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  ...TICKET_STATUSES.map((value) => ({ value, label: statusLabels[value] })),
];

function countFor(stats: TicketStats, status: TicketStatus | undefined): number {
  return status ? stats.byStatus[status] : stats.total;
}

export function StatusFilter({ current, limit, stats }: StatusFilterProps) {
  return (
    <FilterTabs
      label="Filter by status"
      tabs={options.map(({ value, label }) => ({
        label,
        href: listHref({ status: value, limit }),
        current: value === current,
        count: stats && countFor(stats, value),
      }))}
    />
  );
}
