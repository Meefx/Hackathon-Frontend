"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  type Account, type AccountPage, type CollectionStatus, type Dashboard,
  currency, formatDate, getAccounts, getDashboard, statusLabels,
} from "@/lib/api";

function Icon({ kind, size = 20 }: { kind: "grid" | "accounts" | "arrow" | "search" | "refresh"; size?: number }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    accounts: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h4" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 11-2l3 4M4 15l3 4a7 7 0 0 0 11-2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

export function CollectionWorkspace({ view }: { view: "overview" | "accounts" }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [page, setPage] = useState<AccountPage | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CollectionStatus | "">("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setDateLabel(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryError(false);
    getDashboard(controller.signal).then(setDashboard).catch(() => {
      if (!controller.signal.aborted) {
        setDashboard(null);
        setSummaryError(true);
      }
    });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timeout = setTimeout(() => {
      getAccounts(search, status, offset, controller.signal)
        .then(setPage)
        .catch(() => {
          if (!controller.signal.aborted) setError("We couldn’t load the accounts. Check your connection and try again.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [search, status, offset, revision]);

  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);

  function filterStatus(value: CollectionStatus | "") {
    setStatus(value);
    setOffset(0);
  }

  return <div className="workspace">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark">c<span>f</span></span>CollectFlow<span className="brand-dot">.</span></Link>
      <div className="workspace-label">COLLECTIONS WORKSPACE</div>
      <nav aria-label="Main navigation">
        <Link href="/" className={`nav-link ${view === "overview" ? "active" : ""}`} aria-current={view === "overview" ? "page" : undefined}><Icon kind="grid" />Overview</Link>
        <Link href="/accounts" className={`nav-link ${view === "accounts" ? "active" : ""}`} aria-current={view === "accounts" ? "page" : undefined}><Icon kind="accounts" />Accounts</Link>
      </nav>
      <div className="sidebar-bottom"><span className="small-dot" />Development workspace<p>A clearer view of every account.</p><span className="version">COLLECTFLOW / V0.1</span></div>
    </aside>

    <main id="main" className="main">
      <header className="topbar"><span>Workspace <span className="slash">/</span> <strong>{view === "overview" ? "Overview" : "Accounts"}</strong></span><span className="demo-badge">Demo workspace</span></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">YOUR PORTFOLIO, IN FOCUS</div><h1>{view === "overview" ? "Collections overview" : "Collection accounts"}</h1><p>{view === "overview" ? "Keep track of balances. Know where to focus next." : "Find an account and review its collection status."}</p></div><button className="button" onClick={() => setRevision(value => value + 1)}><Icon kind="refresh" size={16} />Refresh</button></div>

        {view === "overview" && <>
          <div className="section-label"><span>Portfolio snapshot</span><span>{dateLabel} · IDR</span></div>
          {summaryError ? <div className="notice" role="alert">Portfolio summary is unavailable. Use Refresh to try again.</div> : <section className="stats" aria-label="Portfolio summary">
            {[
              { label: "Total outstanding", value: dashboard ? currency(dashboard.total_outstanding) : "—", hint: "Across your entire portfolio", accent: true },
              { label: "Overdue balance", value: dashboard ? currency(dashboard.overdue_amount) : "—", hint: "Accounts past their due date" },
              { label: "Active accounts", value: dashboard?.total_accounts.toLocaleString() ?? "—", hint: "Accounts in your portfolio" },
              { label: "Overdue accounts", value: dashboard?.overdue_accounts.toLocaleString() ?? "—", hint: "Ready for your review" },
            ].map(stat => <article className={`stat-card ${stat.accent ? "accent" : ""}`} key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.hint}</small></article>)}
          </section>}
          <section className="aging-panel" aria-labelledby="aging-title"><div><span className="eyebrow">AGING BREAKDOWN</span><h2 id="aging-title">Every stage, one clear view.</h2><p>Select a stage to filter your accounts.</p></div><div className="buckets">{(["current", "early", "late", "critical"] as CollectionStatus[]).map(bucket => {
            const data = dashboard?.buckets.find(item => item.status === bucket);
            return <button className={`bucket ${status === bucket ? "selected" : ""}`} key={bucket} onClick={() => filterStatus(status === bucket ? "" : bucket)} aria-pressed={status === bucket}><span className={`bucket-dot ${bucket}`} /><strong>{statusLabels[bucket]}</strong><span>{data?.count ?? "—"} accounts</span><small>{data ? currency(data.outstanding_amount) : "—"}</small></button>;
          })}</div></section>
        </>}

        <section className="accounts-panel" aria-labelledby="accounts-title">
          <div className="accounts-heading"><div><h2 id="accounts-title">{view === "overview" ? "Your accounts" : "All accounts"} {page && <span className="count">{page.total}</span>}</h2><p>Review balances, aging, and account ownership.</p></div></div>
          <div className="toolbar"><label className="search"><Icon kind="search" size={18} /><span className="sr-only">Search borrower or loan reference</span><input type="search" placeholder="Search borrower or loan reference…" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setOffset(0); }} /></label><label className="filter"><span>Status</span><select value={status} onChange={event => filterStatus(event.target.value as CollectionStatus | "")}><option value="">All stages</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          <div aria-live="polite" aria-busy={loading}>
            {error ? <div className="empty-state" role="alert"><h3>Connection unavailable</h3><p>{error}</p><button className="button primary" onClick={() => setRevision(value => value + 1)}>Try again</button></div>
              : loading ? <div className="empty-state"><span className="loader" /><p>Loading your accounts…</p></div>
              : !page?.items.length ? <div className="empty-state"><h3>{search || status ? "No matching accounts" : "Your portfolio starts here"}</h3><p>{search || status ? "Try another borrower, loan reference, or stage." : "Accounts will appear here when they are added to your portfolio."}</p>{(search || status) && <button className="button" onClick={() => { setSearch(""); filterStatus(""); }}>Clear filters</button>}</div>
              : <div className="table-scroll"><table><thead><tr><th scope="col">Borrower / Loan</th><th scope="col">Outstanding</th><th scope="col">Due date</th><th scope="col">Aging</th><th scope="col">Assigned to</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead><tbody>{page.items.map(account => <tr key={account.id}><td><div className="borrower"><span className="avatar" aria-hidden="true">{account.borrower_name.split(" ").map(part => part[0]).slice(0, 2).join("")}</span><div><strong>{account.borrower_name}</strong><small>{account.loan_reference}</small></div></div></td><td className="amount">{currency(account.outstanding_amount)}</td><td>{formatDate(account.due_date)}</td><td><span className={`status-pill ${account.status}`}>{statusLabels[account.status]}</span></td><td>{account.assigned_to}</td><td><button className="detail-button" onClick={() => setSelected(account)} aria-label={`View ${account.borrower_name}'s account`}><Icon kind="arrow" size={17} /></button></td></tr>)}</tbody></table></div>}
          </div>
          {page && !loading && !error && page.total > 0 && <div className="pagination"><span>Showing {offset + 1}–{Math.min(offset + page.limit, page.total)} of {page.total} accounts</span><div><button className="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - page.limit))}>Previous</button><button className="button" disabled={offset + page.limit >= page.total} onClick={() => setOffset(offset + page.limit)}>Next</button></div></div>}
        </section>
        <footer className="footer"><span>CollectFlow</span><span>Clarity for every collection.</span></footer>
      </div>
    </main>

    <dialog ref={dialog} onClose={() => setSelected(null)} onClick={event => { if (event.target === dialog.current) setSelected(null); }} aria-labelledby="detail-title">
      {selected && <div className="dialog-content"><div className="dialog-heading"><span className="eyebrow">ACCOUNT DETAILS</span><button className="close-button" onClick={() => setSelected(null)} aria-label="Close account details">×</button></div><h2 id="detail-title">{selected.borrower_name}</h2><p>{selected.loan_reference} · {selected.id}</p><div className="detail-balance"><span>Outstanding balance</span><strong>{currency(selected.outstanding_amount)}</strong></div><dl><div><dt>Status</dt><dd><span className={`status-pill ${selected.status}`}>{statusLabels[selected.status]}</span></dd></div><div><dt>Days past due</dt><dd>{selected.days_past_due}</dd></div><div><dt>Due date</dt><dd>{formatDate(selected.due_date)}</dd></div><div><dt>Assigned to</dt><dd>{selected.assigned_to}</dd></div></dl><button className="button primary" onClick={() => setSelected(null)}>Done</button></div>}
    </dialog>
  </div>;
}
