# Frontend Agentic Collection Skeleton Implementation Plan

> **For agentic workers** — Gunakan skill `superpowers:executing-plans` untuk menjalankan rencana per tugas. Langkah memakai checkbox. Implementasi fitur dimulai setelah rencana ditinjau.

**Goal** — Menambah portal simulasi agent, manager, percakapan account, compliance, audit, dan antrean review pada frontend CollectFlow.

**Architecture** — Next.js mengomposisikan fitur melalui App Router. Typed API client mengonsumsi REST FastAPI yang menyimpan data di PostgreSQL. Backend memiliki aturan bisnis, izin, dan dispatch, sedangkan UI memperlihatkan keputusan dan state aktual.

**Tech Stack** — Next.js 16, React 19, TypeScript strict, CSS Modules, npm, Node.js 22+ dengan Node 24 untuk CI. Playwright ditambahkan saat implementasi perilaku UI untuk menguji retry, stale response, dan alur pengguna.

**Spec** — Brief dan kontrak dalam dokumen ini menjadi spesifikasi skeleton yang ikut repository. Baca `AGENTS.md` dan `README.md`. Bila workspace lengkap tersedia, `../00_Product_Overview.md` menjelaskan arah produk. Rencana backend berada di repository `Hackathon-Backend` pada path dokumen yang sama.

## Brief

Operator memilih account dan memberi instruksi melalui satu layar manager. UI memperlihatkan langkah specialist yang dikembalikan backend, draft, keputusan compliance, percakapan, dan audit. Operator dapat melakukan simulasi inbound dan meminta simulated dispatch. Hardship, dispute, dan human request terlihat pada antrean review serta state case yang paused dari backend.

Registry memperlihatkan enam role, yaitu `manager`, `collection`, `knowledge`, `qa`, `improvement`, dan `copilot`. Simulator menjalankan empat role pertama. Dua role lainnya ditampilkan sebagai belum tersedia. Card memakai konfigurasi runtime aktual dari API. Hermes menjadi milestone integrasi backend setelah MCP berfungsi.

Overview, accounts, search, pagination, aging filter, dan dialog account existing tetap berfungsi. Nama aplikasi tetap CollectFlow dan bahasa UI tetap Inggris. Borrower sintetis dan `simulated_chat` memberi alur demo yang dapat dibaca ulang setelah reload.

## Status dan dependency

| Bagian | Status | Pemilik |
| --- | --- | --- |
| Portfolio `/` dan `/accounts` existing | Tersedia pada bootstrap | Frontend |
| PostgreSQL, migration/import, dan Compose | Selesai dan terverifikasi, 27 test PostgreSQL lulus, Compose serta host startup lulus | Backend database |
| Kontrak REST collection | Usulan dalam kedua rencana | Backend, sinkronisasi frontend |
| Shell baru, agent registry, manager, account workspace, review | Direncanakan | Frontend |
| MCP dan Hermes | Milestone backend terpisah | Backend/integrasi agent |

Implementasi UI dimulai dari transport dan shell, lalu registry, account workspace, manager, serta review. Mock hanya dipakai untuk test terkontrol. Integrasi normal memakai API aktual. Backend harus menyepakati DTO sebelum typed client baru digabungkan.

## Global Constraints

- UI mengonsumsi REST melalui typed client. PostgreSQL dan MCP diakses oleh backend.
- `NEXT_PUBLIC_API_URL` adalah origin publik API. Secret dan credential provider berada pada environment backend.
- Pertahankan field account, enum aging `current|early|late|critical`, pagination `{items,total,limit,offset}`, dan total dashboard untuk seluruh portfolio.
- Rupiah berupa integer. UI memformat uang/tanggal dan menampilkan aging yang dihitung backend dengan kalender `Asia/Jakarta`.
- Backend memutuskan eligibility, waktu contact, verified recipient, compliance, dan dispatch. UI menampilkan `allowed`, `reason_codes`, dan `contact_state` yang dikembalikan API.
- Data demo sintetis, channel `simulated_chat`, dan mode simulasi terlihat jelas. WhatsApp/email/phone tampil sebagai integrasi direncanakan bila ditampilkan.
- Ikuti dependency `app -> features -> shared`. Page berisi komposisi, komponen domain berada pada fitur pemilik, dan fitur baru memakai CSS Modules/token visual existing.
- Sediakan loading, empty, error/retry, success, serta not found. Error API tidak diganti dengan data sukses fiktif.
- Request read dapat dibatalkan. Respons account lama tidak boleh menimpa account yang sedang dibuka. Retry write memakai idempotency key operasi logis yang sama.
- Pertahankan semantic HTML, label, focus terlihat, keyboard navigation, dialog focus, skip link, dan layout mobile.

## Review Focus

1. API mengembalikan error lama berupa `detail` string atau error baru berupa object. Tugas F0 menguji keduanya dan pesan fallback aman.
2. Account berubah ketika request sebelumnya belum selesai. Tugas F2 menguji stale response dan pembatalan fetch.
3. Dispatch berhasil tetapi respons putus, lalu operator retry. Tugas F2 menguji key yang sama dan satu message/delivery.
4. Policy atau case berubah setelah draft muncul. Tugas F2/F3 menguji UI blocked terbaru dan state paused dari backend.
5. Account sudah hilang atau link run/review mengarah ke target invalid. Tugas F2/F4 menguji 404, empty list, dan navigasi keyboard.

## Kontrak REST yang dikonsumsi

Kontrak berikut adalah usulan yang sama dengan rencana backend. Pydantic dan `/openapi.json` backend menjadi sumber kontrak setelah tersedia. Pertahankan payload `snake_case` tanpa mengganti enum atau field diam-diam.

| Operasi client | HTTP dan hasil |
| --- | --- |
| `getAgents(signal?)` | `GET /api/v1/agents` → `{items: AgentDefinition[]}` |
| `startRun(accountId, request, signal?)` | `POST /api/v1/accounts/{account_id}/runs` → `RunResult` |
| `getRun(runId, signal?)` | `GET /api/v1/runs/{run_id}` → `RunResult` |
| `getMessages(accountId, limit, offset, signal?)` | `GET /api/v1/accounts/{account_id}/messages` → `Page<Message>` |
| `receiveDemoMessage(accountId, request, signal?)` | `POST /api/v1/accounts/{account_id}/messages` → `Message` |
| `simulateDispatch(messageId, request, signal?)` | `POST /api/v1/messages/{message_id}/simulate-dispatch` → `DispatchResult` |
| `getReviews(limit, offset, signal?)` | `GET /api/v1/reviews` → `Page<ReviewItem>` |
| `getAudit(accountId, limit, offset, signal?)` | `GET /api/v1/accounts/{account_id}/audit` → `Page<AuditEvent>` |
| `getCurrentPolicy(signal?)` | `GET /api/v1/policies/current` → `PolicySnapshot` |
| `getContactPolicy(accountId, signal?)` | `GET /api/v1/accounts/{account_id}/contact-policy` → `PolicyDecision` |

`Page<T>` memakai `{items,total,limit,offset}`. List baru memakai limit 1–100, offset nonnegatif, default request UI 20, dan urutan `created_at,id` menaik dari backend. Registry berurutan menurut enam role pada brief. URL parameter memakai `URLSearchParams` dan path ID di-encode.

| DTO | Field dan nilai |
| --- | --- |
| `AgentDefinition` | `id`, `name`, `role`, `description`, `runtime_mode` (`simulated|live|unavailable`), `connection_status` (`ready|disconnected|unavailable`) |
| `RunRequest` | `instruction` string 1–2000 karakter setelah trim, `idempotency_key` UUID, `scenario` (`reminder|hardship|dispute|human_request`) |
| `RunStep` | `id`, `role`, `outcome` (`completed|blocked|failed`), `summary` |
| `RunResult` | `id`, `account_id`, `runtime_mode`, `status` (`completed|blocked|failed`), `steps: RunStep[]`, `draft_message_id` nullable, `reason_codes: string[]`, `created_at` |
| `InboundMessageRequest` | `text` string 1–2000 karakter setelah trim, `idempotency_key` UUID, `scenario` dengan enum yang sama seperti run |
| `Message` | `id`, `account_id`, `run_id` nullable, `channel=simulated_chat`, `direction` (`inbound|outbound`), `text`, `status` (`received|draft|simulated_sent|blocked`), `created_at` |
| `DispatchRequest` | `idempotency_key` UUID |
| `DispatchResult` | `message_id`, `status` (`simulated_sent|blocked`), `reason_codes: string[]`, `audit_event_id` |
| `ReviewItem` | `id`, `account_id`, `run_id` nullable, `reason` (`hardship|dispute|human_request`), `status=open`, `created_at` |
| `AuditEvent` | `id`, `account_id`, `run_id` nullable, `action`, `outcome`, `reason_codes`, `correlation_id`, `created_at`, `previous_hash` nullable untuk genesis, `event_hash` |
| `PolicySnapshot` | `id`, `version`, `timezone`, `contact_days: number[]` dengan ISO Senin=1, `contact_start`, `contact_end`, `holiday_coverage_start`, `holiday_coverage_end`, `holidays: string[]`, `max_proactive_contacts_per_local_date`, `approved_templates: {id,text}[]` |
| `PolicyDecision` | `account_id`, `allowed: boolean`, `reason_codes: string[]`, `policy_version` nullable bila policy hilang, `contact_state` (`active|paused_human_review`), `evaluated_at` |

Reason code awal adalah `policy_missing`, `holiday_coverage_missing`, `outside_contact_window`, `recipient_unverified`, `case_paused`, `frequency_limit`, `guardrail_rejected`, `approval_expired`, `approval_invalid`, dan `policy_changed`. UI memberi label Inggris dan fallback `Action blocked` untuk code baru sambil tetap menampilkan code untuk diagnosis.

Business rejection mengembalikan hasil `blocked` yang tercatat. HTTP 404 menandakan resource hilang, 422 input invalid, dan 409 key sama dengan payload berbeda. Error baru memakai `detail={code,message,correlation_id}`. Client tetap mendukung `detail` string pada endpoint existing. Write berhasil dan replay memakai HTTP 200.

## Peta file dan kepemilikan

Semua path relatif terhadap root frontend.

| Area | File dan tanggung jawab |
| --- | --- |
| Transport shared | `src/lib/http.ts` untuk base URL, JSON GET/POST, abort, dan parsing error; `src/lib/format.ts` untuk currency/date/timestamp |
| Client existing | `src/lib/api.ts` mempertahankan ekspor existing sambil memakai transport/formatter shared |
| Layout | `src/components/layout/app-shell.tsx`, `app-shell.module.css` untuk navigation, header, skip link, dan content container |
| Bootstrap consumer | `src/components/collection-workspace.tsx`, `src/app/page.tsx`, `src/app/accounts/page.tsx` memakai shell yang diekstrak tanpa mengubah alur lama |
| Agents | `src/app/agents/page.tsx`, `src/features/agents/api.ts`, `types.ts`, `components/agent-registry.tsx`, `agents.module.css` |
| Accounts detail | `src/app/accounts/[accountId]/page.tsx`, `src/features/accounts/api.ts`, `types.ts`, `components/account-workspace.tsx`, `accounts.module.css` |
| Conversations | `src/features/conversations/api.ts`, `types.ts`, `components/conversation-panel.tsx`, `conversations.module.css` |
| Runs | `src/features/runs/api.ts`, `types.ts`, `components/run-steps.tsx`, `runs.module.css` |
| Compliance | `src/features/compliance/api.ts`, `types.ts`, `components/compliance-panel.tsx`, `reason-labels.ts`, `compliance.module.css` |
| Audit | `src/features/audit/api.ts`, `types.ts`, `components/audit-timeline.tsx`, `audit.module.css` |
| Manager | `src/app/manager/page.tsx`, `src/features/manager/components/manager-workspace.tsx`, `manager.module.css` |
| Review | `src/app/review/page.tsx`, `src/features/reviews/api.ts`, `types.ts`, `components/review-queue.tsx`, `reviews.module.css` |
| Test perilaku | `playwright.config.ts`, `tests/e2e/portfolio.spec.ts`, `agents.spec.ts`, `account-workspace.spec.ts`, `manager.spec.ts`, `review.spec.ts` |

DTO existing accounts tetap satu definisi. Saat dipindahkan ke `features/accounts/types.ts`, `src/lib/api.ts` mengekspor ulang tipe itu untuk consumer existing. `Page<T>` dapat berada di `src/lib/http.ts` karena dipakai beberapa domain. Manager memakai public API/types runs dan accounts, tanpa membuat DTO run kedua.

### Tugas F0 — Ekstrak transport dan shell dengan regresi portfolio

**Pemilik** — Frontend. Dapat dimulai sebelum endpoint collection tersedia.

**File** — Transport/layout/bootstrap consumer pada peta file, `package.json`, `package-lock.json`, `playwright.config.ts`, `tests/e2e/portfolio.spec.ts`, `.github/workflows/checks.yml`, `README.md`.

**Interface** — `request<T>(path: string, options?: {method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal}): Promise<T>` dan `ApiError` dengan `status`, `code?`, `correlationId?`. `AppShell({section,children})` menerima section `overview|accounts|agents|manager|review`. Ekspor `getDashboard`, `getAccounts`, `currency`, `formatDate`, dan `statusLabels` tetap kompatibel.

- [ ] Tambahkan dev dependency `@playwright/test`, script `test:e2e`, dan Chromium setup. Konfigurasi webServer dev port 3000 dan API request interception untuk fixture sintetis. Tambahkan CI test setelah server/browser siap.
- [ ] Tulis test portfolio untuk total seluruh portfolio, filter reset pagination, search, detail dialog, keyboard focus, error/retry, error `detail` string/object, dan navigasi section baru. Jalankan `npx playwright install chromium` lalu `npm run test:e2e -- tests/e2e/portfolio.spec.ts`. Pastikan test section baru gagal sebelum shell berubah.
- [ ] Pindahkan transport/formatter ke shared tanpa implementasi duplikat. Parse response non-JSON/network failure dengan pesan aman. Abort tidak menjadi error pengguna. Gunakan JSON POST dan `Content-Type` hanya bila ada body.
- [ ] Ekstrak shell dan CSS terkait dari bootstrap. Navigation berisi Overview, Accounts, Agents, Manager, Review. Update kedua route existing dan workspace, pertahankan dialog serta perilaku lamanya.
- [ ] Jalankan test tugas ini, `npm run typecheck`, dan `npm run build`. Expected seluruh alur existing dan section navigation lulus. Review diff lalu buat commit tugas ini saat implementasi.

### Tugas F1 — Tambahkan registry agent

**Pemilik** — Frontend. Bergantung pada F0 dan `GET /agents` backend.

**File** — Route/fitur agents pada peta file dan `tests/e2e/agents.spec.ts`.

**Interface** — `getAgents(signal?: AbortSignal): Promise<{items: AgentDefinition[]}>`. Types mengikuti kontrak. Page hanya mengomposisikan shell dan `AgentRegistry`.

- [ ] Tulis test enam role dengan empat `simulated/ready` dan improvement/copilot `unavailable`. Uji loading, empty registry, error/retry, serta payload `disconnected` yang tetap ditampilkan aktual.
- [ ] Jalankan `npm run test:e2e -- tests/e2e/agents.spec.ts` dan pastikan gagal sebelum route tersedia.
- [ ] Implementasikan card role, deskripsi, mode, dan connection status dari API. Gunakan label Inggris seperti `Simulated` dan `Unavailable`. Link manager membuka `/manager`. Tambahkan CSS Module sesuai token existing.
- [ ] Jalankan test tugas ini, `npm run typecheck`, dan `npm run build`. Periksa mobile serta keyboard. Review diff lalu buat commit tugas ini saat implementasi.

### Tugas F2 — Tambahkan account workspace dan percakapan

**Pemilik** — Frontend. Bergantung pada F0 dan endpoint accounts/messages/audit/contact-policy/dispatch backend.

**File** — Route detail accounts, fitur accounts/conversations/compliance/audit/runs pada peta file, `src/components/collection-workspace.tsx`, `tests/e2e/account-workspace.spec.ts`.

**Interface** — `getAccount(accountId, signal?) -> Promise<Account>`, client percakapan/policy/audit pada tabel kontrak, serta `AccountWorkspace({accountId: string})`. Account detail memakai service GET existing. Account dialog mendapat link `Open workspace` dan tetap dapat ditutup seperti sebelumnya.

- [ ] Tulis test direct URL account valid/404, empty conversation/audit, GET failure terpisah, pagination, dan delayed response account A yang selesai setelah navigasi ke B. Assert seluruh panel tetap milik B.
- [ ] Tulis test inbound dengan scenario eksplisit, validasi kosong/2001 karakter, simulated dispatch, blocked reason, HTTP 409, dan retry sesudah respons dispatch terputus. Assert retry memakai UUID yang sama dengan payload awal.
- [ ] Jalankan `npm run test:e2e -- tests/e2e/account-workspace.spec.ts` dan pastikan gagal sebelum fitur tersedia.
- [ ] Implementasikan typed client dan panel account facts, conversation, draft, contact policy, audit, serta run steps saat run tersedia. Pindahkan `getAccounts` ke public API fitur accounts dan ekspor ulang dari `src/lib/api.ts` agar consumer lama tetap memakai satu implementasi. Baca run melalui query `run_id` pada URL setelah manager navigation dan validasi `run.account_id` cocok dengan account route.
- [ ] Implementasikan form simulasi inbound dan tombol simulated dispatch. Buat key melalui `crypto.randomUUID()` sekali per aksi logis, pertahankan key/payload untuk retry, dan cegah submit bersamaan. Membatalkan request write tidak dianggap membatalkan write server. Refetch history/policy/audit setelah outcome terkonfirmasi.
- [ ] Tampilkan `paused_human_review` dari `PolicyDecision`, reason code, dan `simulated_sent` dari backend. Abaikan respons stale dan batalkan read saat unmount/account berganti. Format event timestamp eksplisit dalam `Asia/Jakarta`.
- [ ] Jalankan test tugas ini, `npm run typecheck`, dan `npm run build`. Periksa focus, mobile, serta GET reload yang tidak membuat message baru. Review diff lalu buat commit tugas ini saat implementasi.

### Tugas F3 — Hubungkan satu layar manager

**Pemilik** — Frontend. Bergantung pada F1/F2 dan endpoint run backend.

**File** — Route/fitur manager, public API/types runs dan accounts, `tests/e2e/manager.spec.ts`.

**Interface** — `startRun(accountId: string, request: RunRequest, signal?: AbortSignal): Promise<RunResult>` dan `getRun(runId, signal?): Promise<RunResult>`. Account selector memakai client accounts existing dengan search/pagination agar account di luar halaman pertama dapat dipilih.

- [ ] Tulis test memilih account hasil search, validasi instruksi, empat scenario, serta completed/blocked/failed. Uji network retry mempertahankan instruksi, payload, dan key. Uji account berubah tidak menampilkan hasil run account sebelumnya.
- [ ] Jalankan `npm run test:e2e -- tests/e2e/manager.spec.ts` dan pastikan gagal sebelum route tersedia.
- [ ] Implementasikan manager instruction, account selector, scenario selector, dan submit. Tampilkan runtime aktual serta ordered specialist steps dari `RunResult`. Tampilkan outcome gagal dan blocked secara terpisah.
- [ ] Berikan link `/accounts/{accountId}?run_id={runId}` untuk membuka run/draft yang persisted. Pertahankan scope account dan state retry. Refetch decision setelah run escalation agar UI menunjukkan pause terbaru.
- [ ] Jalankan test tugas ini, `npm run typecheck`, dan `npm run build`. Periksa keyboard dan layar mobile. Review diff lalu buat commit tugas ini saat implementasi.

### Tugas F4 — Tampilkan antrean review manusia

**Pemilik** — Frontend. Bergantung pada F0/F2 dan endpoint review backend.

**File** — Route/fitur reviews pada peta file dan `tests/e2e/review.spec.ts`.

**Interface** — `getReviews(limit: number, offset: number, signal?: AbortSignal): Promise<Page<ReviewItem>>`. Review menampilkan record open dan link workspace account, ditambah query `run_id` bila tersedia.

- [ ] Tulis test hardship/dispute/human request, review tanpa run, pagination, empty/error/retry, invalid account target, serta keyboard navigation ke workspace yang paused.
- [ ] Jalankan `npm run test:e2e -- tests/e2e/review.spec.ts` dan pastikan gagal sebelum route tersedia.
- [ ] Implementasikan read-only review queue dengan reason, timestamp Jakarta, account ID, dan open status. Link memakai ID backend. State pause dibaca kembali pada workspace melalui contact-policy.
- [ ] Jalankan test tugas ini, `npm run typecheck`, dan `npm run build`. Review diff lalu buat commit tugas ini saat implementasi.

### Tugas F5 — Verifikasi integrasi API aktual

**Pemilik** — Frontend dan backend. Bergantung pada F1–F4 dan REST backend.

**File** — `README.md`, `.env.example` bila cara menjalankan berubah, dan test terdampak bila ditemukan regresi.

- [ ] Jalankan backend PostgreSQL sesuai README backend. Jalur Compose yang disiapkan adalah `docker compose up --build -d --wait`, lalu `docker compose exec backend uv run --no-sync python -m app.seed` dari root backend. Fondasi database sudah diverifikasi melalui Compose dan host startup. Verifikasi alur collection dilakukan setelah endpoint fitur tersedia.
- [ ] Dari root frontend jalankan `npm ci` bila dependency belum tersedia, lalu `npm run dev`. Gunakan `NEXT_PUBLIC_API_URL=http://localhost:8000` dan origin frontend yang diizinkan backend.
- [ ] Verifikasi allowed reminder → draft → simulated dispatch → conversation/audit melalui UI normal. Retry dispatch dan pastikan satu delivery. Jalankan blocked contact dan hardship → review → paused case. Reload setiap layar untuk memastikan persistence.
- [ ] Periksa ulang overview, total portfolio, search/filter/pagination, account dialog, dan mobile/keyboard. Cocokkan request/response aktual terhadap OpenAPI, termasuk 404/422/409 dan blocked outcome.
- [ ] Jalankan `npm run test:e2e`, `npm run typecheck`, dan `npm run build`. Catat test ter-mock dan browser terhadap backend aktual secara terpisah.
- [ ] Update README dengan start order, requirement backend, mode simulator, dan cakupan verifikasi aktual. Laporkan hasil frontend terpisah dari handshake MCP serta koneksi Hermes milik backend. Review diff lalu buat commit tugas ini saat implementasi.

## Batas penerimaan

Frontend selesai ketika operator dapat memakai registry, manager, account workspace, dan review melalui REST aktual untuk allowed reminder, blocked contact, dan escalation manusia. Setiap data-backed screen memiliki state lengkap dan alur existing tetap berfungsi. Browser UI tidak menjadi pemilik aturan dispatch.

WhatsApp/email/phone nyata, live voice, rekonsiliasi pembayaran, deployment improvement otomatis, dan autentikasi remote/multi-tenant menjadi milestone berikutnya. MCP/Hermes dibuktikan dalam rencana backend.

## Verifikasi dokumen

README, panduan repo, routes, client/types existing, dan plan gabungan awal telah dibaca. Semua file fitur dan test di atas masih direncanakan. Framework test frontend belum terpasang pada bootstrap. Command `test:e2e` berlaku setelah F0 menambahkan dependency/script. Penyusunan dokumen tidak menjalankan build atau browser.
