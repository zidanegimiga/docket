import type { ReactNode } from "react";

import styles from "./Field.module.css";

export interface FieldMessages {
  hint?: string | undefined;
  error?: string | undefined;
}

interface FieldProps extends FieldMessages {
  id: string;
  label: string;
  children: ReactNode;
}

export function describedBy(id: string, { hint, error }: FieldMessages): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
