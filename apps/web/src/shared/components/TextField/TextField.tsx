import { Field, useFieldControl, type FieldMessages } from "../Field";
import { Input, type InputProps } from "../Input";

export interface TextFieldProps extends InputProps, FieldMessages {
  label: string;
}

/** A labelled text input with hint and error. Specialised fields such as PasswordField wrap it. */
export function TextField({ label, hint, error, id, ...rest }: TextFieldProps) {
  const { field, control } = useFieldControl({ id, label, hint, error });

  return (
    <Field {...field}>
      <Input {...control} {...rest} />
    </Field>
  );
}
