import type { ReactNode } from "react";

import styles from "./auth-layout.module.css";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <p className={styles.brand}>Docket</p>
        {children}
      </div>
    </main>
  );
}
