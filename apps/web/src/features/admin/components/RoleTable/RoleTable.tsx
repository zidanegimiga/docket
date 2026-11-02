import type { Role } from "@docket/contracts";
import Link from "next/link";

import styles from "./RoleTable.module.css";

interface RoleTableProps {
  roles: Role[];
  selectedId: string | undefined;
  hrefFor: (role: Role) => string;
  canManage: boolean;
}

export function RoleTable({ roles, selectedId, hrefFor, canManage }: RoleTableProps) {
  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col">Permissions</th>
            <th scope="col">People</th>
            <th scope="col">
              <span className={styles.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id} aria-selected={role.id === selectedId || undefined}>
              <td className={styles.nameCell}>
                <span className={styles.name}>
                  {role.name}
                  {role.isSystem && (
                    <>
                      {" "}
                      <span className={styles.tag}>Built in</span>
                    </>
                  )}
                </span>
                {role.description && <span className={styles.description}>{role.description}</span>}
              </td>
              <td className={styles.number}>{role.permissions.length}</td>
              <td className={styles.number}>{role.userCount}</td>
              <td className={styles.actions}>
                <Link
                  className={styles.edit}
                  href={hrefFor(role)}
                  scroll={false}
                  aria-label={`${canManage ? "Edit" : "View"} ${role.name}`}
                >
                  {canManage ? "Edit" : "View"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
