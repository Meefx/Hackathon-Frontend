# Graceline

Next.js 16, React 19 and strict TypeScript portal for a synthetic lending collections demo. English interface, integer Indonesian rupiah and event times in Asia/Jakarta.

## Run locally

Requires Node.js 22+ (Node 24 recommended), npm, and the [FastAPI backend](https://github.com/Meefx/Hackathon-Backend).

```sh
cp .env.example .env.local
npm ci
npm run dev
```

Open http://localhost:3000. Start dependencies in this order using the backend README: PostgreSQL, checked-in migrations, explicit synthetic demo seed, API, collection worker (`uv run python -m app.workers.collection`), then frontend. Set backend `DEMO_FIXTURE_ENABLED=true` and `KNOWLEDGE_MODE=demo_fixture` explicitly for a reproducible demo. The API alone accepts queued tasks; the worker advances them.

`NEXT_PUBLIC_API_URL` is the browser-visible API origin (default `http://localhost:8000`). Restart or rebuild after changing it. Add the frontend origin to backend `CORS_ORIGINS`; browser tests use `http://127.0.0.1:3100`. Credentials for Hermes, MCP, classifiers and providers belong in the backend environment.

For Hermes, configure the remote runtime/bridge and MCP endpoint in the backend using its runbook. Integrations shows configured, health and actual execution mode separately. Configured but unknown health is unverified; a live run still needs backend validation. Runtime and knowledge outages display API errors or persisted blocked/interrupted outcomes.

## Portal

- `/` and `/manager`: the main Manager conversation, saved chats, optional account context, task results and draft review in one workspace.
- `/settings`: Manager runtime preference and links to operational tools. The initial runtime follows the backend Manager configuration. An explicit browser preference applies to the next available chat turn.
- `/portal`: whole-portfolio totals, daily automation activity, account lists and aging/status filters. Account details offer a contextual **Discuss with manager** handoff. `/overview` remains an alias.
- `/accounts`: search, filtering, pagination and accessible detail dialog.
- `/accounts/{id}`: facts, contact policy, conversations, simulated inbound/dispatch, takeover/resume, run history and read-only audit.
- The chat sidebar contains new chat, Portal, conversation history and Settings. Account search and evidence expand in context.
- `/manager/tasks` retains advanced account tasks and account session history for follow up, collector brief and improvement review.
- `/runs/{id}`: persisted status, ordered specialist evidence, artifacts, immutable knowledge snapshots, events, cancellation and permitted recovery.
- `/agents`: six role profiles with configured and available status.
- `/review`: human escalation queue, resolution and separate case resume outcome.
- `/integrations`: sanitized runtime, knowledge, MCP, guardrail and channel status.

Only `simulated_chat` dispatches synthetic messages. WhatsApp, email and phone are explicit unavailable provider skeletons. Policy, recipient, knowledge references, approval and dispatch gates are owned by the backend.

The Gmail API sandbox appears separately in Integrations with configuration and connection health. Configure OAuth credentials and a fixed team test recipient in the backend, then run `uv run python -m app.integrations.gmail authorize` and `uv run python -m app.integrations.gmail send-test --request-id 00000000-0000-4000-8000-000000000001` from its terminal. Reuse the request ID for an exact retry. Choose a fresh UUID for each intentional new test. The test sends fixed synthetic content to the configured team mailbox. A successful send confirms Gmail API acceptance. Verify recipient delivery in the test mailbox. Provider credentials stay in the backend environment.

In `/integrations`, the Gmail card also offers **Run email collection demo**. Each click creates a fresh synthetic borrower and runs simulated agent draft generation, backend dispatch gates and real Gmail delivery to the fixed team test mailbox. The card shows the masked recipient, persisted job status, account/run links and Gmail provider message ID. Reload recovers the saved demo through read requests. An unconfirmed acceptance offers **Retry same email demo** with its original request key. After a terminal outcome, **Run another email demo** creates a new request. Opening the page reads status. `submitted` confirms Gmail API acceptance. Check the test inbox to verify delivery. `delivery_unknown` keeps its outcome visible for an operator decision.

## Recovery

The manager stores only account/session/run IDs, an idempotency request key, runtime mode and selected account context in browser storage. Instructions and messages remain in server history and page memory. After a lost submission response or refresh, the saved key finds the accepted run through a read request. In-memory retries preserve the exact write payload/key. Opening a confirmed account task acknowledges its submission journal. Portfolio chat restores its saved conversation and latest run in place. An unconfirmed chat request is recovered through `GET /api/v1/manager/chat/requests/{key}`. A missing acceptance requires an explicit fresh-request choice. Run URLs and server session history remain available. Inline simulated draft approval persists only the message-scoped request key and expected version until the outcome is confirmed. Reload uses read requests and a retry requires an explicit click with the same payload.

Chat sends free-text instructions to the backend Manager Agent. Simulated mode labels synthetic responses and evidence explicitly. Hermes uses the configured backend runtime and MCP tools. Proposed account tasks require an operator click. Acceptance first reads for an existing task using the proposal artifact ID as its stable idempotency key, then submits the exact proposal payload. Progress, specialist results and earlier task proposals remain in the conversation. Follow-up drafts load their authoritative message and contact policy before offering **Approve simulated send** in chat. The backend rechecks every dispatch gate. Drafts for other channels link to their existing account controls. Human review resolution is available through Settings and the review queue.

Run polling has no overlapping requests, aborts on navigation, backs off during connection errors and preserves monotonically increasing versions/event sequences. “Status update delayed” preserves the last confirmed outcome. Cancellation is a request until worker confirmation. Reconcile/retry controls follow backend `allowed_actions`. Review resolution can leave the case paused; resume never sends a message.

## Checks

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

The fixture browser suite starts Next on port 3100 and intercepts HTTP only inside tests. The application always uses the backend REST API. GitHub Actions runs typecheck, build and Chromium fixture tests.

The separate integration smoke suite requires the actual API, migrated/seeded PostgreSQL, running worker, explicit simulator/demo knowledge configuration, and CORS for port 3100:

```sh
npm run test:smoke
```

Smoke tests create persistent synthetic tasks/messages/reviews and intentionally exercise human pause. They require at least one currently eligible synthetic account, and verify follow up → evidence → reload → dispatch → escalation → resolve, plus collector brief and improvement proposal. They do not prove live Hermes, live classifier, live knowledge retrieval, or remote MCP connectivity; verify those with the backend integration suite and operational evidence.

The separate knowledge-module smoke uses an explicitly prepared synthetic critical document, a contact-eligible synthetic account, and backend `KNOWLEDGE_MODE=knowledge_module` with the in-process trust service. The document must be approved before the test. It is retired by the test and dispatch must then be blocked. Run it separately from the demo-fixture journey. Set `TRUST_API_TOKEN` in the test process environment. Credentials are read only by the Node-side test process.

```sh
KNOWLEDGE_MODULE_SMOKE=1 KNOWLEDGE_DOCUMENT_ID=synthetic-document-id \
KNOWLEDGE_ACCOUNT_ID=synthetic-account-id \
npm run test:smoke -- --grep knowledge_module
```

Without `KNOWLEDGE_MODULE_SMOKE=1`, this scenario is skipped. The existing smoke journey continues to require `KNOWLEDGE_MODE=demo_fixture`.

## Structure

```text
src/app/                 Route composition and global styles
src/components/layout/   Shared portal shell
src/components/ui/       Generic data states and visual panels
src/features/            Accounts, dashboard, manager, runs, conversations,
                         agents, integrations, knowledge, compliance, reviews, audit
src/hooks/               Generic cancellable remote reads
src/lib/http.ts          JSON transport and structured API errors
src/lib/format.ts        IDR/date/Asia-Jakarta formatting
src/lib/api.ts           Bootstrap compatibility exports
src/components/collection-workspace.tsx  Existing portfolio composition
tests/e2e/               Controlled browser fixtures and failure/race tests
tests/smoke/             Actual backend/worker/PostgreSQL journeys
```

Pydantic models and backend OpenAPI are the executable HTTP contract. Ordinary histories use `{items,total,limit,offset}`; run knowledge is a list of immutable snapshots to support additional retrievals in one run. The evidence panel loads 20 snapshots per request, caches explicitly loaded pages and offers next-page and numbered-page controls. Citations remain pending while history pages are unloaded, then link to the loaded source. Critical context previews are bounded to 20 entries and 8,000 characters per entry. Stored retrieval profiles and provenance hashes are displayed when available. Synthetic source URIs remain plain provenance text. No secret belongs in `NEXT_PUBLIC_*`, a fixture, or the client bundle.
