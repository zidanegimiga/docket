export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

interface Issue {
  path: string;
  message: string;
}

export function toFieldErrors<Field extends string>(
  issues: readonly Issue[],
  fields: readonly Field[],
  prefix = "",
): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {};

  for (const issue of issues) {
    const name = issue.path.startsWith(prefix) ? issue.path.slice(prefix.length) : issue.path;
    const field = fields.find((candidate) => candidate === name);
    if (field && !errors[field]) errors[field] = issue.message;
  }

  return errors;
}
