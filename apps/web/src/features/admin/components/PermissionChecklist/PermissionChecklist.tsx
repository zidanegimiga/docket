import { PERMISSION_DESCRIPTIONS, PERMISSIONS, type Permission } from "@docket/contracts";

import { CheckboxOption } from "../CheckboxOption";

interface PermissionChecklistProps {
  /** Form field name; checked permissions are submitted under it. */
  name: string;
  checked: readonly Permission[];
  disabled?: boolean;
}

/** Every permission in the catalog with its plain description, in catalog order. */
export function PermissionChecklist({ name, checked, disabled }: PermissionChecklistProps) {
  return PERMISSIONS.map((permission) => (
    <CheckboxOption
      key={permission}
      name={name}
      value={permission}
      label={permission}
      hint={PERMISSION_DESCRIPTIONS[permission]}
      defaultChecked={checked.includes(permission)}
      disabled={disabled}
    />
  ));
}

/** Reads the permissions a PermissionChecklist submitted. */
export function readPermissions(data: FormData, name: string): Permission[] {
  const submitted = new Set(data.getAll(name).map(String));
  return PERMISSIONS.filter((permission) => submitted.has(permission));
}
