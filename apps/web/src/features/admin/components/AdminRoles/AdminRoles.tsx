"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { can } from "@/features/auth/permissions";
import { Button, buttonClassName } from "@/shared/components/Button";

import { useRoles } from "../../hooks/useRoles";
import { NEW_ROLE, parseSelectedRole, roleHref } from "../../role-query";
import listStyles from "../list-layout.module.css";
import { RoleEditor } from "../RoleEditor";
import { RoleTable } from "../RoleTable";

export function AdminRoles() {
  const router = useRouter();
  const selected = parseSelectedRole(Object.fromEntries(useSearchParams()));
  const { data, isPending, isError, refetch } = useRoles();
  const { data: me } = useCurrentUser();

  const canManage = can(me, "roles:manage");
  const creating = selected === NEW_ROLE && canManage;
  const selectedRole = data?.data.find((role) => role.id === selected);
  const editing = creating || selectedRole !== undefined;

  return (
    <div className={listStyles.layout} data-editing={editing ? true : undefined}>
      <div className={listStyles.list}>
        <div className={listStyles.toolbar}>
          <p className={listStyles.message}>
            Roles are named sets of permissions. People hold roles, plus any extra permissions
            granted on the users page.
          </p>
          {canManage && (
            <Link className={buttonClassName("primary")} href={roleHref(NEW_ROLE)} scroll={false}>
              New role
            </Link>
          )}
        </div>

        {isPending && <p className={listStyles.message}>Loading roles…</p>}
        {isError && !data && (
          <div className={listStyles.message} role="alert">
            <p>Roles could not be loaded.</p>
            <Button onClick={() => void refetch()}>Try again</Button>
          </div>
        )}
        {data && (
          <RoleTable
            roles={data.data}
            selectedId={selected}
            hrefFor={(role) => roleHref(role.id)}
            canManage={canManage}
          />
        )}
      </div>

      {editing && (
        <aside className={listStyles.editor}>
          <RoleEditor
            key={selected}
            role={selectedRole}
            canManage={canManage}
            closeHref={roleHref()}
            onCreated={(role) => router.replace(roleHref(role.id), { scroll: false })}
            onDeleted={() => router.replace(roleHref(), { scroll: false })}
          />
        </aside>
      )}
    </div>
  );
}
