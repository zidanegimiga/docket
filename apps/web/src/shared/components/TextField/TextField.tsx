import { useId, type ComponentProps } from "react";

import { describedBy, Field, type FieldMessages } from "../Field";
import styles from "./TextField.module.css";

interface TextFieldProps extends ComponentProps<"input">, FieldMessages {
  label: string;
}

export function TextField({ label, hint, error, id, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field id={inputId} label={label} hint={hint} error={error}>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, { hint, error })}
        {...rest}
      />
    </Field>
  );
}
