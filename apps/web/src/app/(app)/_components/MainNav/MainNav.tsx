"use client";

import type { Permission } from "@docket/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { can } from "@/features/auth/permissions";

import styles from "./MainNav.module.css";

const links: { href: string; label: string; permission: Permission }[] = [
  { href: "/", label: "Tickets", permission: "tickets:read" },
  { href: "/admin/users", label: "Users", permission: "users:read" },
];

/** The signed-in app's sections, each shown only to people who can use it. */
export function MainNav() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const visible = links.filter((link) => can(user, link.permission));

  if (visible.length < 2) return null;

  return (
    <nav aria-label="Main" className={styles.nav}>
      {visible.map((link) => {
        const current = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={styles.link}
            aria-current={current ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
