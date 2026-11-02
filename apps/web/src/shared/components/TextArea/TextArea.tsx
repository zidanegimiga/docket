import type { ComponentProps } from "react";

import { Field, useFieldControl, type FieldMessages } from "../Field";
import styles from "./TextArea.module.css";

interface TextAreaProps extends ComponentProps<"textarea">, FieldMessages {
  label: string;
}

export function TextArea({ label, hint, error, id, rows = 4, ...rest }: TextAreaProps) {
  const { field, control } = useFieldControl({ id, label, hint, error });

  return (
    <Field {...field}>
      <textarea {...control} rows={rows} className={styles.textarea} {...rest} />
    </Field>
  );
}
