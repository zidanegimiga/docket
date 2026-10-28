"use client";

import { USER_STATUSES, type AdminUser } from "@docket/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { can } from "@/features/auth/permissions";
import { Button } from "@/shared/components/Button";
import { FilterTabs } from "@/shared/components/FilterTabs";
import { Pagination } from "@/shared/components/Pagination";

import { useAdminUsers } from "../../hooks/useAdminUsers";
import { useRoles } from "../../hooks/useRoles";
import { useUpdateUser } from "../../hooks/useUpdateUser";
import { userStatusFilterLabels } from "../../labels";
import { updateUserErrorMessage } from "../../messages";
import { parseUserListView, userListHref, type UserListView } from "../../user-query";
import { UserEditor } from "../UserEditor";
import { UserTable } from "../UserTable";
import styles from "./AdminUsers.module.css";

function emptyMessage({ status, search }: UserListView): string {
  if (search) return `No users match "${search}".`;
  if (status === "pending") return "Nobody is waiting for approval.";
  if (status) return `No ${userStatusFilterLabels[status].toLowerCase()} users.`;
  return "No users yet.";
}

export function AdminUsers() {
  const router = useRouter();
  const view = parseUserListView(Object.fromEntries(useSearchParams()));
  const { selected, ...query } = view;
  const { data, isPending, isError, isPlaceholderData, refetch } = useAdminUsers(query);
  const { data: roles } = useRoles();
  const { data: me } = useCurrentUser();
  const approve = useUpdateUser();
  const [approveError, setApproveError] = useState<string | null>(null);

  const canManage = can(me, "users:manage");
  const selectedUser = data?.data.find((user) => user.id === selected);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = String(new FormData(event.currentTarget).get("search") ?? "").trim();
    router.replace(userListHref({ status: view.status, limit: view.limit, search }), {
      scroll: false,
    });
  };

  const handleApprove = (user: AdminUser) => {
    setApproveError(null);
    approve.mutate(
      { id: user.id, change: { status: "active" } },
      { onError: (error) => setApproveError(updateUserErrorMessage(error)) },
    );
  };

  return (
    <div className={styles.layout} data-editing={selectedUser ? true : undefined}>
      <div className={styles.list}>
        <div className={styles.toolbar}>
          <FilterTabs
            label="Filter by status"
            tabs={[undefined, ...USER_STATUSES].map((status) => ({
              label: status ? userStatusFilterLabels[status] : "All",
              href: userListHref({ status, limit: view.limit, search: view.search }),
              current: status === view.status,
            }))}
          />
          <form className={styles.search} role="search" onSubmit={handleSearch}>
            <input
              type="search"
              name="search"
              aria-label="Search by name or email"
              placeholder="Name or email"
              defaultValue={view.search ?? ""}
              key={view.search ?? ""}
              maxLength={100}
            />
            <Button type="submit">Search</Button>
          </form>
        </div>

        {approveError && (
          <p className={styles.error} role="alert">
            {approveError}
          </p>
        )}
        {isPending && <p className={styles.message}>Loading users…</p>}
        {isError && !data && (
          <div className={styles.message} role="alert">
            <p>Users could not be loaded.</p>
            <Button onClick={() => void refetch()}>Try again</Button>
          </div>
        )}
        {data && (
          <>
            <UserTable
              users={data.data}
              emptyMessage={emptyMessage(view)}
              selectedId={selected}
              hrefFor={(user) => userListHref({ ...view, selected: user.id })}
              canManage={canManage}
              onApprove={handleApprove}
              approvingId={approve.isPending ? approve.variables.id : undefined}
              stale={isPlaceholderData}
              compact={selectedUser !== undefined}
            />
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              hrefFor={(page) => userListHref({ ...view, page, selected: undefined })}
            />
          </>
        )}
      </div>

      {selectedUser && roles && (
        <aside className={styles.editor}>
          <UserEditor
            key={selectedUser.id}
            user={selectedUser}
            roles={roles.data}
            canManage={canManage}
            closeHref={userListHref({ ...view, selected: undefined })}
          />
        </aside>
      )}
    </div>
  );
}
