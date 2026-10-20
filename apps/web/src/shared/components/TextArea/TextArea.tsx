import { useId, type ComponentProps } from "react";

import { describedBy, Field, type FieldMessages } from "../Field";
import styles from "./TextArea.module.css";

interface TextAreaProps extends ComponentProps<"textarea">, FieldMessages {
  label: string;
}

export function TextArea({ label, hint, error, id, rows = 4, ...rest }: TextAreaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <Field id={textareaId} label={label} hint={hint} error={error}>
      <textarea
        id={textareaId}
        rows={rows}
        className={styles.textarea}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(textareaId, { hint, error })}
        {...rest}
      />
    </Field>
  );
}
