import styles from "./AppHeader.module.css";

export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.brand}>Docket</span>
        <span className={styles.section}>Support</span>
      </div>
    </header>
  );
}
