import Link from "next/link";

import styles from "./Pagination.module.css";

interface PaginationProps {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}

export function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1 && page <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      {hasPrevious ? (
        <Link className={styles.link} href={hrefFor(page - 1)} replace scroll={false}>
          Previous
        </Link>
      ) : (
        <span className={styles.disabled}>Previous</span>
      )}

      <span className={styles.position}>
        Page {page} of {Math.max(totalPages, 1)}
      </span>

      {hasNext ? (
        <Link className={styles.link} href={hrefFor(page + 1)} replace scroll={false}>
          Next
        </Link>
      ) : (
        <span className={styles.disabled}>Next</span>
      )}
    </nav>
  );
}
