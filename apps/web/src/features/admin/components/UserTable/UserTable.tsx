import type { AdminUser } from "@docket/contracts";
import Link from "next/link";

import { Button } from "@/shared/components/Button";
import { DISPLAY_TIME_ZONE, formatDateTime } from "@/shared/format/date";

import { userStatusLabels } from "../../labels";
import styles from "./UserTable.module.css";

interface UserTableProps {
  users: AdminUser[];
  emptyMessage: string;
  selectedId: string | undefined;
  hrefFor: (user: AdminUser) => string;
  /** Shows the one-click approve button on pending users. */
  canManage: boolean;
  onApprove: (user: AdminUser) => void;
  approvingId: string | undefined;
  stale?: boolean;
  /** Drops the secondary columns, for when the editor takes half the width. */
  compact?: boolean;
}

export function UserTable({
  users,
  emptyMessage,
  selectedId,
  hrefFor,
  canManage,
  onApprove,
  approvingId,
  stale = false,
  compact = false,
}: UserTableProps) {
  if (users.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.scroller}>
      <table className={styles.table} aria-busy={stale || undefined} data-stale={stale}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Status</th>
            {!compact && <th scope="col">Roles</th>}
            {!compact && <th scope="col">Last sign-in ({DISPLAY_TIME_ZONE})</th>}
            <th scope="col">
              <span className={styles.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} aria-selected={user.id === selectedId || undefined}>
              <td className={styles.nameCell}>
                <span className={styles.name}>{user.name}</span>
                <span className={styles.email}>{user.email}</span>
              </td>
              <td>
                <span className={styles.status} data-status={user.status}>
                  {userStatusLabels[user.status]}
                </span>
              </td>
              {!compact && (
                <td className={styles.roles}>
                  {user.roles.length > 0 ? user.roles.map((role) => role.name).join(", ") : "None"}
                </td>
              )}
              {!compact && (
                <td className={styles.date}>
                  {user.lastLoginAt ? (
                    <time dateTime={user.lastLoginAt}>{formatDateTime(user.lastLoginAt)}</time>
                  ) : (
                    "Never"
                  )}
                </td>
              )}
              <td className={styles.actions}>
                {canManage && user.status === "pending" && (
                  <Button
                    variant="primary"
                    busy={approvingId === user.id}
                    onClick={() => onApprove(user)}
                    aria-label={`Approve ${user.name}`}
                  >
                    Approve
                  </Button>
                )}
                <Link
                  className={styles.edit}
                  href={hrefFor(user)}
                  scroll={false}
                  aria-label={`${canManage ? "Edit" : "View"} ${user.name}`}
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
