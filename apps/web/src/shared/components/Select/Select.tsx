import { useId, type ComponentProps } from "react";

import { describedBy, Field, type FieldMessages } from "../Field";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends ComponentProps<"select">, FieldMessages {
  label: string;
  options: readonly SelectOption[];
}

export function Select({ label, hint, error, id, options, ...rest }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <Field id={selectId} label={label} hint={hint} error={error}>
      <select
        id={selectId}
        className={styles.select}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(selectId, { hint, error })}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
