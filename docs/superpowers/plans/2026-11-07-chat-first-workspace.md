# Chat-first workspace implementation plan

> **For agentic workers** Required workflow is superpowers:executing-plans. Execute in the existing checkout and preserve unrelated work. Commit and push remain user-owned.

## Approved design

The user approved chat as the main workspace, a sidebar containing new chat and conversation history, and Settings for operational configuration. A subsequent clarification keeps Portal directly accessible beside chat, for account lists, balances and collection status. The Manager chooses account tasks through its existing backend tools. Account context, proposed work, execution progress, results, draft review, and approval appear in the conversation. Backend authorization, contact policy, review requirements, and dispatch gates remain authoritative.

**Goal** Deliver a usable chat-first workspace through existing REST contracts.

**Architecture** Reuse durable manager sessions, proposed account runs, polling, and replay keys. Compose existing feature APIs through focused manager components. Preserve advanced routes under Settings and expose the portfolio dashboard directly at `/portal`, retaining `/overview` as an alias. Use backend agent configuration as the initial runtime and store an explicit operator preference separately from request recovery.

**Tech stack** Next.js 16, React 19, strict TypeScript, CSS Modules, existing Playwright tests.

**Spec** Approved design above and the user conversation dated 7 November 2026.

## Global constraints

- English UI and existing brand tokens.
- Synthetic data and simulated dispatch for this conversation workflow.
- Existing API payloads, integer IDR, and Asia/Jakarta display formats.
- No dependencies, database migrations, or changes to provider delivery.
- Browser storage contains identifiers, runtime preference, and replay metadata only.
- An uncertain write retains its exact key and payload until resolved.
- Reuse this suitable checkout and preserve the user's uncommitted integration work.

## Review focus

- Reload or navigation after a lost task/dispatch response must never create a duplicate action.
- Earlier task cards remain usable after another chat turn and after reload.
- Runtime configuration must preserve active or unconfirmed request payloads.
- A paused case, missing policy, failed read, or unsupported channel disables dispatch.
- Mobile navigation, keyboard focus, and a growing transcript keep the composer usable.

## Task 1. Main chat and settings

**Files** `src/components/layout/app-shell.tsx`, its CSS Module, `src/app/page.tsx`, `src/app/overview/page.tsx`, `src/app/settings/page.tsx`, `src/features/manager/components/manager-chat.tsx`, its CSS Module, `src/features/manager/components/manager-settings.tsx`, `src/features/manager/hooks/use-manager-runtime.ts`, `tests/e2e/chat-workspace.spec.ts`.

**Interfaces** AppShell accepts optional sidebar content. Manager runtime exposes configured mode, availability, preference update, loading/error and retry. Existing manager request journal retains the active request's mode.

- [x] Add browser regressions for landing in chat, one sidebar, Settings access, runtime selection, and backend-configured default.
- [x] Run those tests and confirm the missing behavior fails.
- [x] Implement the shell, chat layout and settings using existing agent/integration reads.
- [x] Update existing overview and mobile navigation tests to use their new entry points.
- [x] Run typecheck and affected browser tests.

## Task 2. Work results inside the conversation

**Files** `src/features/manager/components/chat-run-progress.tsx`, `task-proposal-card.tsx`, `prepared-task.tsx`, `src/features/manager/components/manager-chat.tsx`, `tests/e2e/chat-workspace.spec.ts`.

**Interfaces** TaskProposalCard reuses proposal artifact ID as the account-run idempotency key. PreparedTask accepts a persisted run ID and displays live state, specialist steps, artifacts, and evidence. Historical manager turns expose their own run cards.

- [x] Add regressions for prepare task to inline result, lost acceptance to read-only recovery, and historical cards surviving later turns and reload.
- [x] Run those tests and confirm the missing behavior fails.
- [x] Implement inline child run composition while retaining advanced evidence links.
- [x] Run all manager and new workspace browser tests.

## Task 3. Draft review and simulated approval

**Files** `src/features/conversations/components/draft-review.tsx`, `src/features/conversations/index.ts`, `src/features/manager/components/prepared-task.tsx`, `tests/e2e/chat-workspace.spec.ts`, `README.md`.

**Interfaces** DraftReview accepts account and message IDs. It reads the authoritative message and contact policy, paginates old messages explicitly, and uses existing simulate-dispatch with exact message version and replay key. Dispatch recovery metadata is scoped to message ID and contains no text.

- [x] Add regressions for approve simulated send, paused policy, historical message pagination, uncertain send retry/reload, and backend rejection.
- [x] Run those tests and confirm the missing behavior fails.
- [x] Implement the focused domain component and compose it into prepared tasks.
- [x] Update the portal README to describe actual entry points and approval behavior.
- [x] Run typecheck, production build, full browser suite, and review the final diff.
- [x] Inspect the real local UI at desktop and mobile widths.

## Progress

Plan established from the user's approved direction. Existing changes concern integration work and are preserved.

Task 1 implemented. The initial three chat/settings regressions failed before implementation. Configured runtime, preference persistence and one-sidebar layout passed after implementation.

Task 2 implemented. Both inline task and historical proposal regressions failed before implementation and passed afterward. Discovery reads preserve a child run already confirmed during task acceptance.

Task 3 implemented. Five inline draft regressions failed before implementation. The final manager/recovery focused suite passed 24 tests. A first full browser suite passed 84 tests and exposed one legacy navigation selector. That test now reaches Agents through Settings and passed in the focused suite.

The fresh read-only reviewer found no Important or Critical issue. Provider delivery is outside this UI change. Backend revalidation governs stale displayed policy. Storage failure surfaces a warning and preserves the in-memory request while the page stays open.

Mobile history is initially collapsed. Long responses scroll independently of the composer. Saved-chat selection now updates the direct session URL, with a failing regression verified before the fix.

Live local browser checks completed a simulated manager conversation and an actual Hermes conversation through the normal chat form. Both returned `manager_replied`, each with one saved Manager response and zero draft artifacts. Browser page-error capture was empty.

User clarification added first-class Portal navigation and direct account-to-chat handoff. The new browser regression failed on the missing Portal link before implementation.

The complete 89-test browser suite passed against both the development server and a production build. Visual QA exposed an existing mobile overflow from an absolutely positioned screen-reader table label. Anchoring `.table-scroll` with `position: relative` fixes its containing block. The new mobile regression failed before that one-line correction and passed afterward.

Final verification passed. `npm run typecheck`, `npm run build`, and `npm run test:e2e -- --workers=3` completed successfully, with all 90 Chromium fixture tests passing against the production build. The final production Portal mobile viewport and root scroll width both measured 390px. Live Hermes and simulated chat smoke checks completed through the normal UI. The temporary production verification server was stopped after checks.
