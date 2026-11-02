"use client";

import {
  createRoleSchema,
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
  type CreateRoleInput,
  type Role,
  type UpdateRoleInput,
} from "@docket/contracts";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/components/Button";
import { TextField } from "@/shared/components/TextField";
import { toFieldErrors, type FieldErrors } from "@/shared/forms/field-errors";

import { useRoleMutations } from "../../hooks/useRoleMutations";
import { roleErrorMessage } from "../../messages";
import { canChangePermissions, canDelete, canRename } from "../../role-rules";
import styles from "../editor.module.css";
import { PermissionChecklist, readPermissions } from "../PermissionChecklist";

const FIELDS = ["name", "description", "permissions"] as const;
type Field = (typeof FIELDS)[number];

interface RoleEditorProps {
  /** The role to edit, or undefined to create one. */
  role: Role | undefined;
  /** Without roles:manage the editor is read-only. */
  canManage: boolean;
  closeHref: string;
  onCreated: (role: Role) => void;
  onDeleted: () => void;
}

/**
 * Creates or edits a role. Uncontrolled inputs start from the saved values; the parent keys this
 * component by role so switching roles resets the form.
 */
export function RoleEditor({ role, canManage, closeHref, onCreated, onDeleted }: RoleEditorProps) {
  const { create, update, remove } = useRoleMutations();
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const headingId = useId();

  const editable = {
    name: canManage && (!role || canRename(role)),
    permissions: canManage && (!role || canChangePermissions(role)),
  };
  const busy = create.isPending || update.isPending || remove.isPending;

  const showError = (error: unknown) => {
    if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
      const issues = Array.isArray(error.details) ? error.details : [];
      setErrors(toFieldErrors(issues, FIELDS, "body."));
      return;
    }
    setFormError(roleErrorMessage(error));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setSaved(false);

    const data = new FormData(event.currentTarget);
    // Disabled inputs are not submitted, so locked fields are simply left out of the change.
    const change: UpdateRoleInput = {
      ...(editable.name && { name: String(data.get("name") ?? "") }),
      description: String(data.get("description") ?? ""),
      ...(editable.permissions && { permissions: readPermissions(data, "permissions") }),
    };

    if (!role) {
      const input: CreateRoleInput = {
        name: change.name ?? "",
        description: change.description,
        permissions: change.permissions ?? [],
      };
      // Checked here for instant field errors; the API parses the same input again.
      const parsed = createRoleSchema.safeParse(input);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));
        setErrors(toFieldErrors(issues, FIELDS));
        return;
      }
      create.mutate(input, { onSuccess: onCreated, onError: showError });
      return;
    }

    update.mutate({ id: role.id, change }, { onSuccess: () => setSaved(true), onError: showError });
  };

  const handleDelete = () => {
    if (!role) return;
    setFormError(null);
    remove.mutate(role.id, {
      onSuccess: onDeleted,
      onError: (error) => {
        setConfirmingDelete(false);
        showError(error);
      },
    });
  };

  return (
    <section className={styles.editor} aria-labelledby={headingId}>
      <div className={styles.header}>
        <div>
          <h2 id={headingId}>{role ? role.name : "New role"}</h2>
          {role && (
            <p className={styles.muted}>
              Held by {role.userCount} {role.userCount === 1 ? "person" : "people"}
              {role.isSystem && ". Built in"}
            </p>
          )}
        </div>
        <Link className={styles.close} href={closeHref} scroll={false}>
          Close
        </Link>
      </div>

      <form
        className={styles.form}
        onSubmit={handleSubmit}
        onInput={() => setSaved(false)}
        noValidate
      >
        <fieldset className={styles.fieldset} disabled={!canManage || busy}>
          <TextField
            name="name"
            label="Name"
            defaultValue={role?.name ?? ""}
            maxLength={ROLE_NAME_MAX_LENGTH}
            disabled={!editable.name}
            hint={role && !canRename(role) ? "Built-in roles keep their names." : undefined}
            error={errors.name}
            required
          />
          <TextField
            name="description"
            label="Description"
            defaultValue={role?.description ?? ""}
            maxLength={ROLE_DESCRIPTION_MAX_LENGTH}
            hint="Optional. Shown to administrators when they assign roles."
            error={errors.description}
          />

          <fieldset className={styles.group}>
            <legend>Permissions</legend>
            {role && !canChangePermissions(role) && (
              <p className={styles.muted}>The admin role always holds every permission.</p>
            )}
            {errors.permissions && <p className={styles.error}>{errors.permissions}</p>}
            <PermissionChecklist
              name="permissions"
              checked={role?.permissions ?? []}
              disabled={!editable.permissions}
            />
          </fieldset>
        </fieldset>

        {canManage && (
          <div className={styles.actions}>
            <Button type="submit" variant="primary" busy={create.isPending || update.isPending}>
              {role ? "Save changes" : "Create role"}
            </Button>
            <p className={styles.muted} role="status">
              {saved && "Saved. Changes reach people with this role within ten minutes."}
            </p>
          </div>
        )}
        {formError && (
          <p className={styles.error} role="alert">
            {formError}
          </p>
        )}
      </form>

      {canManage && role && !role.isSystem && (
        <div className={styles.danger}>
          {role.userCount > 0 ? (
            <p className={styles.muted}>
              To delete this role, first remove it from the {role.userCount}{" "}
              {role.userCount === 1 ? "person who holds" : "people who hold"} it.
            </p>
          ) : confirmingDelete ? (
            <div className={styles.actions} role="group" aria-label="Confirm deletion">
              <p>Delete {role.name}? This cannot be undone.</p>
              <Button variant="primary" busy={remove.isPending} onClick={handleDelete}>
                Delete role
              </Button>
              <Button onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button onClick={() => setConfirmingDelete(true)} disabled={!canDelete(role)}>
              Delete role…
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
