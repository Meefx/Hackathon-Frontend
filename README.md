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
- `/settings`: Manager runtime preference. The initial runtime follows the backend Manager configuration. An explicit browser preference applies to the next available chat turn.
- `/portal`: whole-portfolio totals, daily automation activity, account lists and aging/status filters. **Agent WhatsApp messages** shows full outbound message text, borrower, loan reference, Jakarta timestamp and persisted delivery status, with newest-first pagination, a 15-second refresh, and links to the account conversation. Failed and unconfirmed dispatch attempts are labeled explicitly. Account details offer a contextual **Discuss with manager** handoff. `/overview` remains an alias.
- `/accounts`: search, filtering, pagination and accessible detail dialog.
- `/accounts/{id}`: facts, contact policy, conversations, simulated inbound/dispatch, takeover/resume, run history and read-only audit.
- The sidebar provides Portfolio overview, Accounts, Human review, Agents, Knowledge graph, Integrations, Advanced account tasks and Settings across the workspace. Chat also includes new chat and conversation history. Navigation scrolls horizontally on mobile. Account search and evidence expand in context.
- `/manager/tasks` retains advanced account tasks and account session history for follow up, collector brief and improvement review.
- `/runs/{id}`: agent activity map, persisted status, ordered specialist evidence, artifacts, immutable knowledge snapshots, events, cancellation and permitted recovery. The same map appears in the Manager chat while a task runs.
- `/agents`: six role profiles with configured and available status.
- `/knowledge`: interactive knowledge graph with local, explicitly synthetic concepts and source references. Opens independently of the API.
- `/review`: human escalation queue, resolution and separate case resume outcome.
- `/integrations`: sanitized runtime, knowledge, MCP, guardrail and channel status.

Synthetic messages use `simulated_chat`, the opt-in WhatsApp self-chat sandbox, or the dedicated fixed-recipient Gmail demo. Hermes sandbox drafts use labeled demo screening. Phone remains unavailable. Policy, recipient, knowledge references, approval and dispatch gates are owned by the backend.

The Gmail API sandbox appears separately in Integrations with configuration and connection health. Configure OAuth credentials and a fixed team test recipient in the backend, then run `uv run python -m app.integrations.gmail authorize` and `uv run python -m app.integrations.gmail send-test --request-id 00000000-0000-4000-8000-000000000001` from its terminal. Reuse the request ID for an exact retry. Choose a fresh UUID for each intentional new test. The test sends fixed synthetic content to the configured team mailbox. A successful send confirms Gmail API acceptance. Verify recipient delivery in the test mailbox. Provider credentials stay in the backend environment.

In `/integrations`, the Gmail card also offers **Run email collection demo**. Each click creates a fresh synthetic borrower and runs simulated agent draft generation, backend dispatch gates and real Gmail delivery to the fixed team test mailbox. The card shows the masked recipient, persisted job status, account/run links and Gmail provider message ID. Reload recovers the saved demo through read requests. An unconfirmed acceptance offers **Retry same email demo** with its original request key. After a terminal outcome, **Run another email demo** creates a new request. Opening the page reads status. `submitted` confirms Gmail API acceptance. Check the test inbox to verify delivery. `delivery_unknown` keeps its outcome visible for an operator decision.

## Knowledge graph demo

Run the graph on its own with Node.js 22+ and npm:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000/knowledge](http://localhost:3000/knowledge), or choose **Knowledge graph** in the sidebar. No backend or environment variables are required for this route. Other portal features retain their backend requirements.

The canvas uses React Flow (`@xyflow/react`) for pan, wheel/pinch zoom, draggable nodes, a pannable minimap, fit-to-view, and resetting node positions. Select a concept to highlight its direct relationships and inspect descriptions, incoming/outgoing connections, and expandable source excerpts. Use **Focus connections** to isolate its neighborhood. Search includes descriptions, tags, and source references; matching concepts appear with their connected context. Category chips, the relationship filter, and the edge-label toggle refine the view. Nodes support keyboard selection and movement through React Flow's built-in accessibility controls.

The feature lives in `src/features/knowledge/graph/`. `types.ts` defines the semantic knowledge model, `demo-data.ts` contains 22 concepts, 36 directed relationships, and four synthetic source records. `graph-model.ts` keeps filtering, validation, and presentation positions separate from the dataset. To connect a real knowledge source later, replace `loadDemoGraph()` with a source adapter that returns the typed model and validates references. Local source IDs use `demo://` and are displayed as provenance text. The existing run knowledge evidence API is independent of this demo; graph relationships do not determine eligibility or authorize collection actions. Loading, source-load retry, no-selection, and no-filter-results states are included.

## Recovery

The manager stores only account/session/run IDs, an idempotency request key, runtime mode and selected account context in browser storage. Instructions and messages remain in server history and page memory. After a lost submission response or refresh, the saved key finds the accepted run through a read request. In-memory retries preserve the exact write payload/key. Opening a confirmed account task acknowledges its submission journal. Portfolio chat restores its saved conversation and latest run in place. An unconfirmed chat request is recovered through `GET /api/v1/manager/chat/requests/{key}`. A missing acceptance requires an explicit fresh-request choice. Run URLs and server session history remain available. Inline simulated draft approval persists only the message-scoped request key and expected version until the outcome is confirmed. Reload uses read requests and a retry requires an explicit click with the same payload.

Chat sends free-text instructions to the backend Manager Agent. Simulated mode labels synthetic responses and evidence explicitly. Hermes uses the configured backend runtime and MCP tools. Proposed account tasks require an operator click. Acceptance first reads for an existing task using the proposal artifact ID as its stable idempotency key, then submits the exact proposal payload. Progress, specialist results and earlier task proposals remain in the conversation. Follow-up drafts load their authoritative message and contact policy before offering **Approve simulated send** in chat. The backend rechecks every dispatch gate. Drafts for other channels link to their existing account controls. Human review resolution is available through Settings and the review queue.

Run polling has no overlapping requests, aborts on navigation, backs off during connection errors and preserves monotonically increasing versions/event sequences. “Status update delayed” preserves the last confirmed outcome. Cancellation is a request until worker confirmation. Reconcile/retry controls follow backend `allowed_actions`. Review resolution can leave the case paused; resume never sends a message.

The agent activity map shows Manager and subagents observed in native Hermes lifecycle events. Select a node to inspect its runtime ID, status, last event and available tool activity. Parallel children can appear active together. Specialist profile names are shown only when evidenced by the runtime; current Hermes lifecycle events identify children by ID. Simulated runs use explicitly labeled persisted simulator steps. Activity refreshes separately from run status so a telemetry outage preserves the task and its recorded output.

Detailed Hermes activity is read from the runtime's bounded event replay. A replay gap, expired event history or interrupted connection is shown explicitly. A child with no confirmed completion becomes unverified when its parent run ends. Run status, artifacts and the existing evidence history remain persisted in the backend. The activity view requires the backend `GET /api/v1/runs/{id}/activity` endpoint.

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

### Hermes test delivery

A Hermes follow-up for a synthetic account linked through **Connect WhatsApp test channel**
can produce an approved WhatsApp draft. Use **Send WhatsApp test** to deliver it to self-chat.
In Integrations, select **Hermes** under **Email agent runtime**, then **Run email collection demo**
to generate and automatically deliver a synthetic draft to the fixed backend test mailbox.
The worker and Hermes MCP connection must be running. Backend sandbox screening, contact policy,
recipient verification and signed dispatch approvals apply. The demo classifier is labeled
`sandbox_demo_fixture`. The browser persists the selected runtime with an uncertain request
so retry after reload recovers the same account, run and delivery.
