import { useId } from "react";

import { describedBy, type FieldMessages } from "./Field";

export interface FieldControlOptions extends FieldMessages {
  /** Uses this id instead of a generated one, for example to point other elements at the control. */
  id?: string | undefined;
  label: string;
}

/**
 * The wiring every labelled control shares: one id linking label, control, hint and error, and
 * the ARIA state for errors. Spread `field` onto <Field> and `control` onto the control element.
 */
export function useFieldControl({ id, label, hint, error }: FieldControlOptions) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  return {
    field: { id: controlId, label, hint, error },
    control: {
      id: controlId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy(controlId, { hint, error }),
    },
  };
}
