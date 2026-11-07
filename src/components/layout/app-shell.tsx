"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./app-shell.module.css";
const routes = [
  ["/manager", "Back to chat"],
  ["/portal", "Portal"],
  ["/settings", "Settings"],
];
export function AppShell({
  title,
  children,
  sidebar,
  variant = "default",
}: {
  title: string;
  children: ReactNode;
  sidebar?: ReactNode;
  variant?: "default" | "chat";
}) {
  const path = usePathname();
  return (
    <div className={`workspace ${variant === "chat" ? styles.chatWorkspace : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${styles.sidebar}`}>
        <Link href="/" className={`brand ${styles.brand}`}>
          <span className="brand-mark">gl</span>Graceline
          <span className="brand-dot">.</span>
        </Link>
        {sidebar || <nav aria-label="Main navigation" className={styles.navigation}>
          {routes.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`${styles.navLink} ${path === href ? styles.active : ""}`}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>}
        <div className={styles.footer}>
          {sidebar && <Link href="/settings" className={styles.navLink}>Settings</Link>}
          <small>Synthetic collection workspace</small>
        </div>
      </aside>
      <main className={`main ${variant === "chat" ? styles.chatMain : ""}`} id="main">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> <strong>{title}</strong>
          </span>
          <span className="demo-badge">Demo workspace</span>
        </header>
        <div className={`content ${styles.content} ${variant === "chat" ? styles.chatContent : ""}`}>{children}</div>
      </main>
    </div>
  );
}
