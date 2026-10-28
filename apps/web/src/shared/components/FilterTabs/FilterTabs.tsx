import Link from "next/link";

import styles from "./FilterTabs.module.css";

export interface FilterTab {
  label: string;
  href: string;
  current: boolean;
  count?: number | undefined;
}

interface FilterTabsProps {
  /** Names the navigation for screen readers, such as "Filter by status". */
  label: string;
  tabs: FilterTab[];
}

/** Links that switch a list's filter through the URL, so the view can be shared and reloaded. */
export function FilterTabs({ label, tabs }: FilterTabsProps) {
  return (
    <nav aria-label={label}>
      <ul className={styles.filters}>
        {tabs.map((tab) => (
          <li key={tab.label}>
            <Link
              className={styles.filter}
              href={tab.href}
              aria-current={tab.current ? "page" : undefined}
              replace
              scroll={false}
            >
              {tab.label}
              {tab.count !== undefined && (
                <>
                  {" "}
                  <span className={styles.count}>{tab.count}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
