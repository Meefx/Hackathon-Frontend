# Frontend Agentic Collection System Implementation Plan

> **For agentic workers** — Gunakan superpowers:executing-plans atau superpowers:subagent-driven-development sesuai metode eksekusi yang dipilih user. Jalankan tugas per milestone dengan bukti verifikasi.

**Goal** — Menyelesaikan portal collection dengan manager Hermes, run history/progress, knowledge evidence, conversations, compliance, review, dan integration skeleton.

**Architecture** — App Router mengomposisikan fitur. Typed client mengonsumsi REST backend. Portal melakukan polling run persisten serta menampilkan status/izin/keputusan yang dikembalikan backend.

**Tech Stack** — Next.js 16, React 19, TypeScript strict, CSS Modules, npm, Node.js 22+ dan Node 24 pada CI. Playwright ditambahkan pada implementasi perilaku UI beserta script/CI dan lockfile.

**Spec** — Brief, kontrak v2, dan acceptance dalam dokumen ini dapat dipakai saat repo di-clone sendiri. Baca AGENTS.md dan README.md. Rencana backend berada pada path dokumen yang sama di repository backend. Master workspace bernama 2026-11-07-agentic-collection-system-plan.md.

## Brief dan kondisi saat ini

Operator memilih account, membuka manager session, mengirim tugas, mengikuti progress specialist, dan membaca draft beserta sumber knowledge. Operator dapat melakukan simulated inbound/dispatch, meninjau escalation, dan menjalankan tindakan manusia yang diizinkan backend.

Source saat ini mempunyai Overview/Accounts, account dialog, search/filter/pagination, dan GET client. Seluruh layar collection berikut adalah target implementasi. Backend PostgreSQL foundation tersedia; REST collection, Hermes bridge, dan MCP masih direncanakan.

Knowledge management berada pada service di backend yang sama dan dimiliki teman user. Portal mengonsumsi evidence dan status melalui REST. Tampilan pengelolaan ingestion/indexing knowledge mengikuti ownership modul tersebut.

## Global Constraints

- Pertahankan nama CollectFlow, bahasa UI Inggris, portfolio existing, integer Rupiah, dan status aging dari backend.
- Gunakan dependency app -> features -> shared. Page berisi komposisi. Komponen domain, typed API, dan state berada pada fitur pemilik.
- Semua data domain melalui typed API client. Identity, policy, approval, recipient, serta dispatch ditentukan backend.
- NEXT_PUBLIC_API_URL adalah public API origin. Secret Hermes/MCP/provider berada pada backend.
- Data demo sintetis dan mode runtime aktual terlihat. Skeleton channel memperlihatkan unavailable.
- Sediakan loading, empty, error/retry, success, dan not found. Network error tidak diganti dengan success fixture pada aplikasi normal.
- Batalkan request read saat navigasi. Write yang responsnya hilang direkonsiliasi memakai request key yang sama.
- Gunakan HTML semantik, keyboard/focus, dialog yang aksesibel, serta mobile layout. CSS Modules mengikuti token existing.
- Event timestamp ditampilkan dalam Asia/Jakarta. UI memformat aging/uang sesuai nilai backend.

## Review Focus

1. POST202 berhasil tetapi respons hilang atau halaman direfresh. F2 menguji lookup request_key dan recovery journal.
2. Polling lambat atau response account lama datang setelah navigasi. F2/F3 menguji monotonic version, no overlap, dan stale response.
3. Runtime sudah selesai tetapi business artifact invalid atau worker stop belum confirmed. F2 menampilkan keputusan backend tanpa mengasumsikan success.
4. Knowledge unavailable, no_results, reference revoked, atau citation salah. F4 menguji evidence snapshot dan blocked reason.
5. Dua resolve/dispatch serta status integration stale. F3/F5/F6 menguji conflict version, idempotency, dan dependency status aktual.

## Kontrak bersama versi 2

Kontrak ini adalah target implementasi. Pydantic dan OpenAPI backend menjadi kontrak HTTP yang dijalankan. Kontrak MCP diuji melalui discovery SDK. Endpoint portfolio existing mempertahankan field, enum, pagination, urutan, dan satuan uang.

| DTO | Field dan nilai |
| --- | --- |
| StartRunRequest | instruction string 1–2000 karakter, task_type follow_up/collector_brief/improvement_review, runtime_mode simulated/hermes, idempotency_key UUID, manager_session_id UUID nullable. demo_scenario reminder/hardship/dispute/human_request hanya diterima dalam mode simulated. |
| RunAccepted | run_id, manager_session_id, status queued, version, created_at. POST berhasil dan replay mengembalikan HTTP 202 serta identitas run yang sama. |
| RunSnapshot | id, account_id, manager_session_id, status queued/running/completed/blocked/failed/cancelled/interrupted, outcome nullable, requested_runtime_mode, actual_runtime_mode nullable, phase, steps, artifacts, reason_codes, version, session_turn_index, latest_event_seq, created_at, started_at nullable, finished_at nullable, heartbeat_at nullable, cancellation_requested_at nullable, allowed_actions. |
| RunStep | id, sequence, role, status pending/running/completed/blocked/failed/skipped, summary, evidence_origin backend_verified/runtime_reported/agent_reported, started_at nullable, finished_at nullable. |
| RunEvent | sequence, run_id, type, safe_summary, evidence_origin, created_at. Sequence monotonik per run. |
| AgentDefinition | id, role manager/collection/knowledge/qa/improvement/copilot, name, description, configured, available, runtime_mode simulated/hermes/unavailable, capabilities, unavailable_reason nullable, checked_at nullable. |
| IntegrationStatus | id, kind runtime/knowledge/mcp/guardrail/channel, implemented, configured, health healthy/unavailable/unknown, execution_mode simulated/hermes/in_process/unavailable, capabilities, disabled_reason nullable, checked_at nullable. Seluruh konfigurasi respons sudah disanitasi. |
| KnowledgeSnapshot | id, run_id, status ready/no_results/unavailable/error, source_mode knowledge_module/demo_fixture, required, retrieved_at, snapshot_hash, sources, reason_code nullable. |
| KnowledgeSource | document_id, document_version, snippet_id, citation_id, title, excerpt, content_hash, approved_at, effective_from nullable, effective_until nullable, source_uri nullable. |
| Message | id, account_id, run_id nullable, channel simulated_chat/whatsapp/email/phone, direction inbound/outbound, text, status received/draft/simulated_sent/blocked, version, citation_ids, created_at. |
| DraftCandidate | run_id, account_id, execution_attempt_id, template_id nullable, text_with_placeholders, citation_ids, idempotency_key. Backend merender fakta dan membuat message ID. |
| DispatchRequest | idempotency_key UUID, expected_message_version. Server mengambil approval dan recipient dari state resmi. |
| DispatchResult | message_id, status simulated_sent/blocked/unavailable, reason_codes, audit_event_id. |
| ReviewItem | id, account_id, run_id nullable, reason hardship/dispute/human_request/operator_takeover, status open/resolved, version, created_at, resolved_at nullable. |
| ReviewResolution | decision keep_paused/request_resume, note 1–1000 karakter, expected_version, idempotency_key. Hasil berasal dari service backend. |
| PolicyDecision | account_id, case_version, allowed, reason_codes, policy_version nullable, contact_state active/paused_human_review/paused_operator, evaluated_at. |
| ManagerSession | id, account_id, title, created_at, updated_at, last_run_id nullable. |
| ManagerTurn | id, session_id, turn_index, run_id nullable, role operator/manager, content, created_at. Content berisi instruksi atau ringkasan final yang aman. |
| RunArtifact | id, run_id, kind draft/qa_report/collector_brief/improvement_proposal, text, message_id nullable, citation_ids, review_state pending/approved/rejected nullable, created_at. QA/proposal merupakan advisory evidence. |
| FinalRuntimeResult | application_run_id, task_type, summary, artifact_ids, candidate_message_id nullable, citation_ids, review_requested boolean. Semua reference diverifikasi ke data milik run. |
| KnowledgeQuery | query 1–1000 karakter, purpose collection_draft/qa_check/copilot/improvement_review, locale id-ID, top_k 1–5, deadline_at. Identity/corpus permission berasal dari server context. |
| ReferenceValidation | valid, checked_at, invalid_citation_ids, reference_version. Semantik snapshot/revocation disepakati dengan pemilik KM. |
| CaseActionRequest | expected_case_version, idempotency_key, note 1–1000 karakter. Dipakai takeover/resume oleh operator berizin. |
| CaseActionResult | account_id, case_version, contact_state, action_applied, reason_codes, review_id nullable. |
| ReviewResolutionResult | review ReviewItem, case CaseActionResult. Penyelesaian review dan hasil permintaan resume dipisahkan. |
| GuardrailResult | decision allow/block/unavailable, policy_version, evidence_id, classifier_mode live/demo_fixture, evaluated_at. |
| AuditEvent | id, account_id, run_id nullable, action, actor_kind, outcome, reason_codes, correlation_id, created_at, previous_hash nullable, event_hash. |

List biasa memakai items,total,limit,offset dengan limit 1–100. Event polling memakai items,next_sequence,has_more. Tanggal event memakai UTC timezone-aware. Status handling case terpisah dari aging current/early/late/critical. Outcome run dapat berupa draft_created, escalated, brief_created, atau proposal_created.

HTTP 404 untuk resource hilang, 422 untuk input invalid, 409 untuk konflik key/payload atau version stale, dan 403 untuk caller yang tidak berizin. Write menolak field tak dikenal. Error baru memakai detail berisi code,message,correlation_id. Client tetap mendukung error detail string pada endpoint portfolio existing.

Reason code awal mencakup policy_missing, holiday_coverage_missing, outside_contact_window, recipient_unverified, case_paused, frequency_limit, guardrail_rejected, approval_expired, approval_invalid, policy_changed, guardrail_unavailable, knowledge_unavailable, no_approved_context, knowledge_reference_invalid, runtime_unavailable, runtime_interrupted, result_invalid, channel_unavailable, dan version_conflict. UI menyediakan fallback aman untuk code baru.

Registry agents/integrations memakai items dengan urutan tetap. History run/session berurutan created_at,id menurun; percakapan/audit menaik. Manager turn berurutan turn_index lalu operator sebelum manager. Default pagination adalah 20. allowed_actions dapat memuat cancel, reconcile, dan retry_safe_step sesuai izin/state. RecoverRunRequest memakai action reconcile/retry_safe_step, expected_version, dan idempotency_key.

Contact state diturunkan dari hold aktif. Open review menghasilkan paused_human_review; jika seluruh review sudah resolved tetapi operator hold masih aktif, state menjadi paused_operator; tanpa hold state menjadi active. Seluruh alasan aktif tetap dicatat walaupun UI menampilkan satu contact_state.

## Endpoint target

| Operasi | REST |
| --- | --- |
| Registry agent dan dependency | GET /api/v1/agents; GET /api/v1/integrations |
| Submit tugas account | POST /api/v1/accounts/{account_id}/runs → HTTP 202 RunAccepted |
| Run snapshot dan history | GET /api/v1/runs/{run_id}; GET /api/v1/accounts/{account_id}/runs |
| Event dan recovery | GET /api/v1/runs/{run_id}/events?after_sequence=0&limit=100; POST /api/v1/runs/{run_id}/cancel; POST /api/v1/runs/{run_id}/recover |
| Manager history | GET /api/v1/accounts/{account_id}/manager-sessions; GET /api/v1/manager-sessions/{session_id}/messages |
| Evidence knowledge | GET /api/v1/runs/{run_id}/knowledge |
| Percakapan | GET dan POST /api/v1/accounts/{account_id}/messages |
| Dispatch demo | POST /api/v1/messages/{message_id}/simulate-dispatch |
| Policy dan eligibility | GET /api/v1/policies/current; GET /api/v1/accounts/{account_id}/contact-policy |
| Takeover dan resume case | POST /api/v1/accounts/{account_id}/takeover; POST /api/v1/accounts/{account_id}/resume → CaseActionResult |
| Review manusia | GET /api/v1/reviews; GET /api/v1/reviews/{review_id}; POST /api/v1/reviews/{review_id}/resolve |
| Audit | GET /api/v1/accounts/{account_id}/audit |

GET history run mendukung request_key UUID yang dibatasi account dan caller. Ini menemukan submission yang responsnya hilang. Cancel/recover memakai idempotency_key dan expected_version. Recovery action dipilih dari allowed_actions backend dan ditolak bila execution masih ambigu. Manager session hanya dapat dipakai pada account dan caller yang memilikinya. Simulasi inbound memakai text, idempotency_key, serta demo_scenario yang eksplisit.

## Tampilan dan peta file

| Route/fitur | Tanggung jawab dan file |
| --- | --- |
| Shell lintas halaman | src/components/layout/app-shell.tsx dan app-shell.module.css; Overview/Accounts/Manager/Agents/Review/Integrations |
| Shared transport | src/lib/http.ts, format.ts; ApiError, JSON GET/POST, AbortSignal, dan format timestamp |
| Bootstrap compatibility | src/components/collection-workspace.tsx, src/lib/api.ts, src/app/page.tsx, src/app/accounts/page.tsx |
| Agents | src/app/agents/page.tsx; src/features/agents/api.ts, types.ts, components/agent-registry.tsx |
| Manager | src/app/manager/page.tsx; src/features/manager/api.ts, types.ts, components/manager-workspace.tsx |
| Run detail | src/app/runs/[runId]/page.tsx; src/features/runs/api.ts, types.ts, hooks/use-run-polling.ts, components/run-detail.tsx |
| Account workspace | src/app/accounts/[accountId]/page.tsx; src/features/accounts/ dan conversations/ |
| Knowledge evidence | src/features/knowledge/api.ts, types.ts, components/knowledge-evidence.tsx |
| Compliance dan audit | src/features/compliance/ dan audit/ untuk read panels, reason labels, timeline |
| Human review | src/app/review/page.tsx; src/features/reviews/api.ts, types.ts, components/review-queue.tsx dan review-detail.tsx |
| Integration status | src/app/integrations/page.tsx; src/features/integrations/api.ts, types.ts, components/integration-status.tsx |
| Behavioral tests | playwright.config.ts; tests/e2e/ per user flow; .github/workflows/checks.yml |

Setiap fitur menambah CSS Module saat style dibutuhkan. DTO mempunyai satu definisi publik per fitur. Transport/existing API dapat mengekspor ulang selama consumer dipindahkan. Manager memakai public runs/accounts API. Page atau container account mengomposisikan panel lintas fitur.

## F0 — Kunci typed client dan shell

**Pemilik** — Subagent frontend, root/backend untuk kontrak. **File** — shared transport/shell/bootstrap consumers; package.json/package-lock.json; Playwright config, CI, tests/e2e/portfolio.spec.ts.

- [ ] Cocokkan DTO/endpoints v2 dengan backend sebelum feature client digabungkan. Error parsing mendukung detail string existing dan detail object baru.
- [ ] Tambahkan Playwright minimal dan script test:e2e saat test perilaku pertama dibuat. Test existing search, filters reset pagination, whole-portfolio totals, dialog/focus, 404, retry, dan mobile.
- [ ] Ekstrak fetch/error/formatters dan shell dari bootstrap, lalu pindahkan consumer bertahap. Pertahankan cancellation dan status labels existing.
- [ ] Tambahkan navigation Overview, Accounts, Manager, Agents, Review, dan Integrations. Reuse visual tokens.
- [ ] Jalankan npm run typecheck, npm run build, serta portfolio browser suite. Expected regresi existing lulus.

## F1 — Registry agent dan status dependency

**Pemilik** — Frontend. **File** — agents/integrations features; route pages; tests/e2e/agents.spec.ts, integrations.spec.ts.

- [ ] Tulis tests enam role, configured tetapi unavailable, runtime disconnected, health stale, API gagal, dan capability yang belum tersedia.
- [ ] Implementasikan registry dari AgentDefinition. Tampilkan capability, mode aktual, dan unavailable_reason. Profil yang dikonfigurasi tidak otomatis ditampilkan connected.
- [ ] Implementasikan Integrations untuk Hermes, MCP, KM, policy classifier, simulated_chat, WhatsApp, Email, dan Phone. Skeleton provider memperlihatkan unavailable serta alasan aman dari API.
- [ ] Settings/status menampilkan konfigurasi publik yang sudah disanitasi backend. Credential input/management menjadi milestone tersendiri bila dibutuhkan.
- [ ] Jalankan browser suite fitur, typecheck, dan build. Verifikasi keyboard dan layar sempit.

## F2 — Manager session dan persisted run

**Pemilik** — Frontend. **File** — manager/runs features; manager route; runs/[runId] route; tests/e2e/manager.spec.ts, run-recovery.spec.ts.

- [ ] Tulis tests account search di seluruh portfolio, session/follow-up history, tiga task type, POST202, queued/running/completed/blocked/failed/interrupted/cancelled.
- [ ] Tulis tests dua run pada session yang sama, task kedua menunggu dan memakai history tervalidasi task pertama, serta interrupted yang menahan kelanjutan. Tulis tests lost response, duplicate click, refresh, network retry, interrupted recovery, cancel yang masih diminta, dan run dari account lain.
- [ ] Implementasikan manager dengan account selector, instruksi, task type, serta runtime mode dari capability server. Source mode simulated/hermes terlihat pada submission dan hasil.
- [ ] Simpan journal minimum account ID, request key, session ID, dan run ID pada storage browser. Journal tidak menyimpan isi percakapan/credential. Setelah reload gunakan lookup request_key atau run ID untuk melanjutkan GET.
- [ ] Poll snapshot/event backend setiap dua detik selama aktif, tanpa overlap, dengan backoff dan AbortSignal. Terapkan hanya response version/sequence baru. Network failure menampilkan Status update delayed; status gagal hanya berasal dari backend.
- [ ] Tampilkan ordered steps, evidence_origin, artefak, reason codes, serta actual runtime/profile yang tersedia. Jangan membuat specialist progress yang tidak dikonfirmasi.
- [ ] Cancel/recover hanya memakai allowed_actions backend dan expected_version. POST retry mempertahankan key serta payload. Fresh submission hanya terjadi atas tindakan pengguna yang jelas.
- [ ] Jalankan tests fitur, typecheck, dan build. Expected reload/reconnect melanjutkan run yang sama tanpa write baru.

## F3 — Account workspace dan simulated conversations

**Pemilik** — Frontend. **File** — accounts/conversations/compliance/audit features; detail route; bootstrap detail link; tests/e2e/account-workspace.spec.ts.

- [ ] Tulis tests account valid/404, empty/paginated history, delayed A response setelah navigasi B, approval expired, policy berubah, contact paused, HTTP409, dan retry dispatch sesudah respons putus.
- [ ] Tambahkan Open workspace pada account dialog. Compose account facts, handling state, conversation, candidate draft, contact policy, run history, knowledge evidence, dan audit.
- [ ] Implementasikan explicit simulated inbound dan dispatch. Gunakan satu idempotency key per logical action, cegah duplicate click, serta refetch message/policy/audit setelah outcome terkonfirmasi.
- [ ] Tombol dispatch mengikuti server capabilities dan decision. Backend tetap memeriksa aturan saat tombol diklik. Tampilkan simulated_sent/blocked/unavailable sesuai response.
- [ ] Render event timestamp dalam Asia/Jakarta. Request lama tidak boleh menimpa state account yang baru.
- [ ] Jalankan browser tests, typecheck, build, keyboard/mobile verification. GET reload tidak membuat message baru.

## F4 — Evidence knowledge dan artefak specialist

**Pemilik** — Frontend untuk tampilan; backend adapter serta teman untuk service KM. **File** — knowledge feature dan panel run/account; tests/e2e/knowledge-evidence.spec.ts.

- [ ] Tulis tests ready, no_results, unavailable, error, revoked/version changed, malformed citation, source URI tidak tersedia, dan demo_fixture.
- [ ] Tampilkan snapshot yang dipakai run, bukan query ulang sumber terbaru saat membuka history. Source title, document version, citation/snippet IDs, excerpt, hash/reference, dan retrieval time dapat diperiksa.
- [ ] Tautkan citation draft/QA/brief/proposal pada sumber snapshot. Render semua teks sebagai data. Source URI hanya menjadi tautan yang aman bila tervalidasi.
- [ ] Required knowledge failure menampilkan alasan blocked dari backend dan link status KM pada Integrations. Layar portfolio serta review tetap dapat dibaca.
- [ ] Tampilkan copilot brief dan improvement proposal sebagai artefak run. State proposal menunggu review dan perubahan SOP mengikuti workflow KM yang disepakati kemudian.
- [ ] Jalankan tests fitur, typecheck, build, serta satu browser flow dengan service KM aktual ketika tersedia.

## F5 — Human review, takeover, dan audit

**Pemilik** — Frontend. **File** — reviews/audit features; review route; tests/e2e/review.spec.ts.

- [ ] Tulis tests hardship/dispute/human request/operator takeover, open review lain, double submit resolve, expected_version stale, error/retry, pagination, dan keyboard navigation.
- [ ] Implementasikan queue/detail yang memuat account/run/snapshot links, alasan escalation, pause state, dan timeline.
- [ ] Implementasikan takeover melalui endpoint case dengan expected_case_version dan idempotency key. Tampilkan requested stop terpisah dari confirmed cancellation.
- [ ] Tindakan review keep_paused/request_resume memakai expected_version dan menampilkan ReviewResolutionResult. Review dapat resolved sementara case masih paused. Tombol resume case memakai endpoint terpisah dengan expected_case_version setelah keep_paused. UI merender alasan penolakan jika review/hold lain masih aktif.
- [ ] Setelah keputusan manusia, refetch review/contact policy/audit. Tombol resume/dispatch mengikuti allowed actions terbaru.
- [ ] Audit menampilkan kejadian, actor, correlation, policy/knowledge references, serta outcome. Replay berupa pembacaan.
- [ ] Jalankan suite fitur, typecheck, dan build. Expected review/inbound di luar jam contact tetap terbaca dan keputusan persisten.

## F6 — Verifikasi portal lengkap terhadap backend aktual

**Pemilik** — Frontend, root, backend, dan integrasi Hermes/MCP. **File** — tests/e2e/demo-journey.spec.ts, README.md, env example dan CI bila diperlukan.

- [ ] Jalankan portfolio regression dan seluruh browser tests dengan fixture terkontrol untuk race/failure.
- [ ] Jalankan perjalanan melalui backend PostgreSQL aktual untuk allowed draft/dispatch, blocked contact, escalation/resolve, retry, refresh, dan recovery worker restart.
- [ ] Verifikasi task collector_brief serta improvement_review dengan artefak dan evidence yang dapat dibuka.
- [ ] Hubungkan Hermes aktual bila runtime tersedia dan verifikasi ketiga task type, runtime-backed profile evidence semua enam role, source evidence, candidate, serta business gate dengan classifier live. Uji classifier unavailable menghasilkan blocked draft karantina. Bedakan bukti fixture/simulator dari runtime aktual.
- [ ] Verifikasi Integrations ketika KM/Hermes tidak tersedia dan ketika MCP hidup. Ketiga provider skeleton tetap menampilkan unavailable tanpa receipt palsu.
- [ ] Jalankan npm run typecheck, npm run build, dan npm run test:e2e. Catat versi browser, cakupan, command serta hasil aktual.
- [ ] Update README dengan start order backend/worker/frontend/Hermes, mode demo, dependency status, dan recovery.

## Penerimaan frontend

Portal selesai ketika operator dapat menggunakan registry, manager session/run, account workspace, knowledge evidence, review/resolve, serta integration status melalui REST aktual. Riwayat bertahan setelah reload dan UI mengikuti state backend saat error, pause, cancellation, atau recovery.

Hermes/MCP acceptance dimiliki backend/integration lane dan terlihat pada portal sebagai status aktual. Source aplikasi dan dependency frontend pada turn ini masih baseline existing. Test runner baru akan ditambahkan saat F0 diimplementasikan.
