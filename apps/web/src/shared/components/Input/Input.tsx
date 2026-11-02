import type { ComponentProps, ReactNode } from "react";

import styles from "./Input.module.css";

export interface InputProps extends ComponentProps<"input"> {
  /** Shown inside the border before the text, such as a unit or a search label. */
  start?: ReactNode;
  /** Shown inside the border after the text, such as a show-password or clear button. */
  end?: ReactNode;
}

/**
 * The text input every text-like field builds on. Without adornments it is a plain styled input;
 * with them, the border moves to a wrapper so the extras sit inside the same box.
 */
export function Input({ start, end, className, ...rest }: InputProps) {
  if (!start && !end) {
    return <input className={[styles.input, className].filter(Boolean).join(" ")} {...rest} />;
  }

  return (
    <div className={styles.group}>
      {start && <span className={styles.adornment}>{start}</span>}
      <input className={[styles.bare, className].filter(Boolean).join(" ")} {...rest} />
      {end && <span className={styles.adornment}>{end}</span>}
    </div>
  );
}
