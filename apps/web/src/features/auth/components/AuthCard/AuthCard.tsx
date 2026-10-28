import type { ReactNode } from "react";

import styles from "./AuthCard.module.css";

interface AuthCardProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <section className={styles.card} aria-labelledby="auth-card-title">
      <h1 id="auth-card-title" className={styles.title}>
        {title}
      </h1>
      {children}
      {footer && <div className={styles.footer}>{footer}</div>}
    </section>
  );
}
