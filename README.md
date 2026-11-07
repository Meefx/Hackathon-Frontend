# CollectFlow

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

- `/`: whole-portfolio totals and aging filters.
- `/accounts`: search, filtering, pagination and accessible detail dialog.
- `/accounts/{id}`: facts, contact policy, conversations, simulated inbound/dispatch, takeover/resume, run history and read-only audit.
- `/manager`: portfolio-wide account search, manager sessions and three task types: follow up, collector brief and improvement review.
- `/runs/{id}`: persisted status, ordered specialist evidence, artifacts, immutable knowledge snapshots, events, cancellation and permitted recovery.
- `/agents`: six role profiles with configured and available status.
- `/review`: human escalation queue, resolution and separate case resume outcome.
- `/integrations`: sanitized runtime, knowledge, MCP, guardrail and channel status.

Only `simulated_chat` dispatches synthetic messages. WhatsApp, email and phone are explicit unavailable provider skeletons. Policy, recipient, knowledge references, approval and dispatch gates are owned by the backend.

## Recovery

The manager stores only account/session/run IDs and an idempotency request key in browser storage. It does not store instructions, messages or credentials. After a lost submission response or refresh, the saved key finds the accepted run through a read request. In-memory retries preserve the exact write payload/key. Opening a confirmed run acknowledges the submission journal; run URLs and server session history remain available.

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

Pydantic models and backend OpenAPI are the executable HTTP contract. Ordinary histories use `{items,total,limit,offset}`; run knowledge is a list of immutable snapshots to support additional retrievals in one run. The evidence panel reads every HTTP page before matching citations and renders the complete history so artifact links resolve to later retrievals. No secret belongs in `NEXT_PUBLIC_*`, a fixture, or the client bundle.
