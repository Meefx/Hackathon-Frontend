"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { getAccount } from "../api";
import { getPolicy } from "@/features/compliance/api";
import { CaseControls } from "@/features/compliance";
import { ConversationPanel } from "@/features/conversations";
import { AuditTimeline } from "@/features/audit";
import { RunHistory } from "@/features/runs";
import { AppShell } from "@/components/layout/app-shell";
import { DataState } from "@/components/ui/data-state";
import { useRemote } from "@/hooks/use-remote";
import { currency, formatDate } from "@/lib/format";
import { statusLabels } from "@/features/accounts/constants";
import styles from "@/components/ui/panels.module.css";
import type { CaseActionResult } from "@/features/compliance/types";
import { reasonLabel } from "@/features/compliance/reasons";
export function AccountWorkspace({ accountId }: { accountId: string }) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<CaseActionResult | null>(null);
  const account = useRemote(
    useCallback(
      (signal: AbortSignal) => getAccount(accountId, signal),
      [accountId],
    ),
  );
  const policy = useRemote(
    useCallback(
      (signal: AbortSignal) => {
        void revision;
        return getPolicy(accountId, signal);
      },
      [accountId, revision],
    ),
  );
  return (
    <AppShell title="Account workspace">
      <DataState {...account} retry={account.refresh}>
        {account.data && (
          <>
            <div className={styles.header}>
              <div>
                <h1>{account.data.borrower_name}</h1>
                <p>
                  {account.data.loan_reference} · {account.data.id}
                </p>
              </div>
              <Link
                className="button primary"
                href={`/manager?account=${encodeURIComponent(accountId)}`}
              >
                Ask manager
              </Link>
            </div>
            <div className={styles.stack}>
              <section className={styles.panel}>
                <h2>Account facts</h2>
                <dl className={styles.facts}>
                  <div>
                    <dt>Outstanding</dt>
                    <dd>{currency(account.data.outstanding_amount)}</dd>
                  </div>
                  <div>
                    <dt>Aging</dt>
                    <dd>
                      {statusLabels[account.data.status]} ·{" "}
                      {account.data.days_past_due} days past due
                    </dd>
                  </div>
                  <div>
                    <dt>Due date</dt>
                    <dd>{formatDate(account.data.due_date)}</dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd>{account.data.assigned_to}</dd>
                  </div>
                </dl>
              </section>
              {result && (
                <p className={styles.notice} role="status">
                  Action {result.action_applied ? "applied" : "not applied"}.
                  Case remains {result.contact_state}.{" "}
                  {result.reason_codes.map(reasonLabel).join("; ")}
                </p>
              )}
              <DataState {...policy} retry={policy.refresh}>
                {policy.data && (
                  <CaseControls
                    onResult={setResult}
                    policy={policy.data}
                    onChanged={() => setRevision((value) => value + 1)}
                  />
                )}
              </DataState>
              <ConversationPanel
                accountId={accountId}
                policy={policy.data}
                revision={revision}
                onChanged={() => setRevision((value) => value + 1)}
              />
              <RunHistory accountId={accountId} />
              <AuditTimeline accountId={accountId} revision={revision} />
            </div>
          </>
        )}
      </DataState>
    </AppShell>
  );
}
