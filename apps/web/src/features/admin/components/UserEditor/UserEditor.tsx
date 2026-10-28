"use client";

import {
  PERMISSION_DESCRIPTIONS,
  PERMISSIONS,
  USER_STATUSES,
  type AdminUser,
  type Permission,
  type Role,
  type UserStatus,
} from "@docket/contracts";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";

import { useUpdateUser } from "../../hooks/useUpdateUser";
import { userStatusLabels } from "../../labels";
import { updateUserErrorMessage } from "../../messages";
import styles from "./UserEditor.module.css";

interface UserEditorProps {
  user: AdminUser;
  roles: Role[];
  /** Without users:manage the editor is read-only. */
  canManage: boolean;
  closeHref: string;
}

const statusOptions = USER_STATUSES.map((value) => ({ value, label: userStatusLabels[value] }));

interface CheckboxOptionProps {
  name: string;
  value: string;
  label: string;
  hint?: string | null;
  defaultChecked: boolean;
}

/** The label names the checkbox; the hint is linked as its description, not part of its name. */
function CheckboxOption({ name, value, label, hint, defaultChecked }: CheckboxOptionProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={styles.option}>
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        aria-describedby={hint ? hintId : undefined}
      />
      <div>
        <label htmlFor={id} className={styles.optionName}>
          {label}
        </label>
        {hint && (
          <span id={hintId} className={styles.optionHint}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

function readForm(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    status: data.get("status") as UserStatus,
    roleIds: data.getAll("roleIds").map(String),
    directPermissions: data.getAll("directPermissions").map(String) as Permission[],
  };
}

/**
 * Shows one user's access and lets an administrator change it. Uncontrolled inputs start from
 * the saved values; the parent keys this component by user so switching users resets the form.
 */
export function UserEditor({ user, roles, canManage, closeHref }: UserEditorProps) {
  const updateUser = useUpdateUser();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const headingId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    updateUser.mutate(
      { id: user.id, change: readForm(event.currentTarget) },
      {
        onSuccess: () => setSaved(true),
        onError: (failure) => setError(updateUserErrorMessage(failure)),
      },
    );
  };

  return (
    <section className={styles.editor} aria-labelledby={headingId}>
      <div className={styles.header}>
        <div>
          <h2 id={headingId}>{user.name}</h2>
          <p className={styles.muted}>{user.email}</p>
          <p className={styles.muted}>
            Signs in with{" "}
            {[user.hasPassword && "password", ...user.providers].filter(Boolean).join(" and ") ||
              "nothing yet"}
          </p>
        </div>
        <Link className={styles.close} href={closeHref} scroll={false}>
          Close
        </Link>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} onInput={() => setSaved(false)}>
        <fieldset className={styles.fieldset} disabled={!canManage || updateUser.isPending}>
          <Select name="status" label="Status" defaultValue={user.status} options={statusOptions} />

          <fieldset className={styles.group}>
            <legend>Roles</legend>
            {roles.map((role) => (
              <CheckboxOption
                key={role.id}
                name="roleIds"
                value={role.id}
                label={role.name}
                hint={role.description}
                defaultChecked={user.roles.some((held) => held.id === role.id)}
              />
            ))}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Extra permissions</legend>
            <p className={styles.muted}>Granted on top of the roles above.</p>
            {PERMISSIONS.map((permission) => (
              <CheckboxOption
                key={permission}
                name="directPermissions"
                value={permission}
                label={permission}
                hint={PERMISSION_DESCRIPTIONS[permission]}
                defaultChecked={user.directPermissions.includes(permission)}
              />
            ))}
          </fieldset>
        </fieldset>

        {canManage && (
          <div className={styles.actions}>
            <Button type="submit" variant="primary" busy={updateUser.isPending}>
              {updateUser.isPending ? "Saving…" : "Save changes"}
            </Button>
            <p className={styles.muted} role="status">
              {saved && "Saved. Changes reach their session within ten minutes."}
            </p>
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>

      <div className={styles.effective}>
        <h3>Can currently</h3>
        {user.effectivePermissions.length > 0 ? (
          <ul>
            {user.effectivePermissions.map((permission) => (
              <li key={permission}>{PERMISSION_DESCRIPTIONS[permission]}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>
            Nothing
            {user.status === "active"
              ? ""
              : ` while ${userStatusLabels[user.status].toLowerCase()}`}
            .
          </p>
        )}
      </div>
    </section>
  );
}
