"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./app-shell.module.css";
const routes = [
  ["/", "Overview"],
  ["/accounts", "Accounts"],
  ["/manager", "Manager"],
  ["/agents", "Agents"],
  ["/review", "Review"],
  ["/integrations", "Integrations"],
];
export function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${styles.sidebar}`}>
        <Link href="/" className="brand">
          <span className="brand-mark">cf</span>CollectFlow
          <span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">COLLECTIONS WORKSPACE</div>
        <nav aria-label="Main navigation">
          {routes.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${path === href || (href !== "/" && path.startsWith(href + "/")) ? "active" : ""}`}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          Synthetic data · Simulated channels
          <p>Backend decisions govern every action.</p>
        </div>
      </aside>
      <main className="main" id="main">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> <strong>{title}</strong>
          </span>
          <span className="demo-badge">Demo workspace</span>
        </header>
        <div className={`content ${styles.content}`}>{children}</div>
      </main>
    </div>
  );
}
