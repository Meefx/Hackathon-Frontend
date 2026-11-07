"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceNavigation } from "./workspace-navigation";
import styles from "./app-shell.module.css";
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
        {sidebar || <WorkspaceNavigation includeChatLink />}
        <div className={styles.footer}>
          <Link href="/settings" className={`${styles.navLink} ${path === "/settings" ? styles.active : ""}`}
            aria-current={path === "/settings" ? "page" : undefined}>Settings</Link>
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
