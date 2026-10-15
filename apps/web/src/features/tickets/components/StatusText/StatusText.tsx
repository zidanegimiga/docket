import type { TicketStatus } from "@docket/contracts";

import { statusLabels } from "../../labels";
import styles from "./StatusText.module.css";

interface StatusTextProps {
  status: TicketStatus;
}

export function StatusText({ status }: StatusTextProps) {
  return (
    <span className={styles.status} data-status={status}>
      {statusLabels[status]}
    </span>
  );
}
