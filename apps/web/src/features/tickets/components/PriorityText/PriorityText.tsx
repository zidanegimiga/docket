import type { TicketPriority } from "@docket/contracts";

import { priorityLabels } from "../../labels";
import styles from "./PriorityText.module.css";

interface PriorityTextProps {
  priority: TicketPriority;
}

export function PriorityText({ priority }: PriorityTextProps) {
  return (
    <span className={styles.priority} data-priority={priority}>
      {priorityLabels[priority]}
    </span>
  );
}
