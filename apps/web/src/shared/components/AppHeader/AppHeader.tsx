import type { ReactNode } from "react";

import styles from "./AppHeader.module.css";

interface AppHeaderProps {
  /** Shown at the right-hand end, such as the signed-in user's menu. */
  children?: ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.brand}>Docket</span>
        <span className={styles.section}>Support</span>
        {children}
      </div>
    </header>
  );
}
