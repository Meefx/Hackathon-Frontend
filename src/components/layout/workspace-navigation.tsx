"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app-shell.module.css";

const routes = [
  ["/portal", "Portfolio overview"],
  ["/accounts", "Accounts"],
  ["/review", "Human review"],
  ["/agents", "Agents"],
  ["/knowledge", "Knowledge graph"],
  ["/integrations", "Integrations"],
  ["/manager/tasks", "Advanced account tasks"],
];

export function WorkspaceNavigation({ includeChatLink = false }: { includeChatLink?: boolean }) {
  const path = usePathname();
  return <nav aria-label="Main navigation" className={styles.navigation}>
    {includeChatLink && <Link href="/manager" className={styles.navLink}>Back to chat</Link>}
    {routes.map(([href, label]) => {
      const active = path === href || path.startsWith(`${href}/`) || (href === "/portal" && path === "/overview");
      return <Link
        key={href}
        href={href}
        className={`${styles.navLink} ${active ? styles.active : ""}`}
        aria-current={active ? "page" : undefined}
      >{label}</Link>;
    })}
  </nav>;
}
