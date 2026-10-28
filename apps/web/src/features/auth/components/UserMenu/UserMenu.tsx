"use client";

import type { CurrentUser } from "@docket/contracts";

import { Button } from "@/shared/components/Button";

import { useLogOut } from "../../hooks/useLogOut";
import styles from "./UserMenu.module.css";

interface UserMenuProps {
  user: CurrentUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const logOut = useLogOut();

  return (
    <div className={styles.menu}>
      <span className={styles.name} title={user.email}>
        {user.name}
      </span>
      <Button busy={logOut.isPending} onClick={() => logOut.mutate()}>
        Sign out
      </Button>
    </div>
  );
}
