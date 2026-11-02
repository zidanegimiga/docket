import type { ComponentProps } from "react";

import { Field, useFieldControl, type FieldMessages } from "../Field";
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
  const { field, control } = useFieldControl({ id, label, hint, error });

  return (
    <Field {...field}>
      <select {...control} className={styles.select} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
