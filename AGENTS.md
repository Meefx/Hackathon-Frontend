# Frontend Engineering Standards

## Scope dan kondisi saat ini

Berlaku untuk seluruh repository frontend. Jika tersedia, baca juga
`../AGENTS.md` untuk aturan lintas-repo; panduan ini tetap berlaku saat repo
di-clone sendiri. Instruksi langsung user mengungguli panduan ini.

Stack aktual: Next.js 16 App Router, React 19, TypeScript strict, CSS biasa,
npm dan `package-lock.json`. Node.js minimal 22; CI memakai Node 24.
Tailwind, shadcn/ui, ESLint, dan framework test frontend **belum tersedia**.
Jangan menulis instruksi seolah tool tersebut sudah terpasang.

Bootstrap saat ini menempatkan UI di `src/components/collection-workspace.tsx`
dan client, types, serta formatter di `src/lib/api.ts`. Keduanya merupakan
penempatan awal, bukan tempat menampung semua fitur berikutnya. Ekstrak bertahap
saat fitur terkait berubah, lalu perbarui import dan hapus implementasi duplikat.

## Penempatan kode

Path berikut relatif terhadap root repository. Buat hanya yang dibutuhkan.

```text
src/
  app/
    layout.tsx                   # Layout, metadata, provider global
    globals.css                  # Reset, token, tipografi, style global
    page.tsx                     # Komposisi route dashboard
    accounts/page.tsx             # Komposisi route accounts
  features/
    accounts/
      components/                # AccountsTable, AccountDetailDialog, filter
      hooks/                     # State/effect reusable khusus accounts
      api.ts                     # Request endpoint accounts
      types.ts                   # DTO dan tipe domain accounts
      constants.ts               # Label/status khusus accounts bila perlu
      accounts.module.css        # Style fitur, boleh colocate per komponen
    dashboard/
      components/                # Summary cards dan aging overview
      api.ts                     # Request endpoint dashboard
      types.ts
  components/
    ui/                          # Button, Dialog, Input tanpa aturan domain
    layout/                      # Sidebar, header, app shell lintas halaman
  hooks/                         # Hook generik lintas fitur
  lib/
    http.ts                      # Base URL, fetch, HTTP error handling
    format.ts                    # Format uang/tanggal lintas fitur
public/                          # Asset statis yang disajikan langsung
tests/e2e/                       # Jika tooling browser test diperkenalkan
```

| Kebutuhan | Tempat dan batas tanggung jawab |
| --- | --- |
| Route/URL baru | `src/app/<route>/page.tsx`; komposisi komponen fitur |
| Tabel, dialog, form domain | `src/features/<feature>/components/` |
| Fetch endpoint domain | `src/features/<feature>/api.ts`, memakai transport shared |
| Base URL, abort, parsing error HTTP | `src/lib/http.ts`; saat ini transport masih di `src/lib/api.ts` |
| Type payload backend | `src/features/<feature>/types.ts`; saat ini masih di `src/lib/api.ts` |
| Helper tampilan khusus domain | Di fitur pemilik, bukan `src/lib/` global |
| Komponen/helper generik lintas fitur | `src/components/ui/`, `src/hooks/`, atau `src/lib/` |
| Test unit/komponen | Dekat kode: `*.test.ts` / `*.test.tsx`, setelah runner tersedia |

## Batas modul dan alur dependency

- Alur utama: `app -> features -> shared`. Shared tidak boleh mengimpor fitur
  atau route; fitur tidak boleh mengimpor `app`.
- Modul mewakili domain, bukan jenis teknis: buat `features/accounts`, bukan satu
  folder global `services` yang berisi semua domain.
- Fitur lain hanya boleh memakai ekspor yang sengaja disediakan pada `api.ts`,
  `types.ts`, atau entry point publik kecil. Jangan impor hook/komponen internal
  lintas fitur secara sembarang; komposisikan lewat page/container pemilik.
- Hindari circular import dan barrel export besar yang mencampur server/client.
  Ekstrak abstraksi shared hanya jika benar-benar generik.
- `page.tsx` mengatur route dan komposisi; jangan taruh aturan eligibility,
  perhitungan denda, aging, query SQL, atau pemanggilan provider AI di sana.
- Pisahkan komponen ketika memiliki state, perilaku, atau tanggung jawab sendiri.
  Panjang file menjadi sinyal review, bukan alasan memecah kode tanpa manfaat.

## Aturan implementasi

- Gunakan alias `@/` untuk import dari `src`. Nama file/folder `kebab-case`,
  komponen/type `PascalCase`, fungsi/variabel `camelCase`, hook diawali `use`.
  Ikuti nama khusus App Router (`page.tsx`, `layout.tsx`, dan seterusnya).
- Server Component adalah default; tambahkan `"use client"` hanya pada batas
  yang memerlukan state, effect, event handler, atau browser API. Hindari
  menjadikan seluruh layout client hanya untuk satu kontrol interaktif.
- Semua request domain melalui API client, bukan `fetch` tersebar di JSX.
  Pertahankan cancellation/abort dan cegah hasil request lama menimpa state baru.
- Payload HTTP mengikuti nama field backend, termasuk `snake_case`. Bila perlu
  bentuk khusus UI, lakukan mapping eksplisit; jangan menduplikasi interface yang
  sama di beberapa komponen atau mengandalkan `any` untuk meloloskan typecheck.
- TypeScript type assertion bukan validasi runtime. Validasi input pengguna;
  penegakan aturan bisnis dan otorisasi tetap dilakukan backend.
- Untuk layar berbasis data, sediakan loading, empty, error/retry, dan success.
  Filter/search harus mereset pagination. Jangan ganti error API dengan data demo
  sukses palsu. Dashboard total tetap mengikuti kontrak seluruh portfolio.
- Gunakan state lokal terlebih dahulu. Tambahkan global store hanya untuk state
  yang memang lintas fitur; jangan menyalin state server ke banyak tempat.
- Gunakan HTML semantik, label input, nama tombol yang jelas, focus terlihat,
  navigasi keyboard, dan dialog dengan pengelolaan focus. Periksa layout mobile.
- Pertahankan bahasa UI yang sudah dipakai (saat ini Inggris) kecuali tugas
  meminta perubahan. Format nominal sebagai integer IDR; jangan menghitung ulang
  status collection di frontend atau menampilkan tanggal bergeser karena timezone.
- Style fitur baru menggunakan CSS Modules agar tidak bocor ke fitur lain.
  `globals.css` untuk aturan global; style lama dapat diekstrak saat disentuh.
  Ikuti token visual yang ada sebelum menambah warna/spacing baru.
- `NEXT_PUBLIC_API_URL` adalah origin API publik. Jangan taruh secret, SDK
  provider bercredential, atau akses database di browser bundle. Kebutuhan server
  frontend yang sah harus berada di modul server-only dan tidak terimpor client.

## Menambah fitur: contoh accounts

1. Periksa kontrak accounts di backend dan consumer frontend yang sudah ada.
2. Tempatkan DTO dan request di `features/accounts/types.ts` dan `api.ts`.
   Pakai transport existing; jika memisahkannya ke `lib/http.ts`, migrasikan
   consumer terkait tanpa membuat implementasi kedua.
3. Letakkan UI/state khusus accounts di fitur tersebut. Page mengomposisikannya;
   shell tetap shared. Jangan menambahkan mode baru tanpa batas ke
   `CollectionWorkspace` untuk setiap fitur baru.
4. Perubahan shared harus tetap sesuai kebutuhan consumer lama. Jika memindahkan
   `CollectionWorkspace`, pindahkan juga import kedua route yang memakainya.
5. Verifikasi seluruh state UI, query/filter/pagination, aksesibilitas, serta
   kesesuaian payload. Sinkronkan README bila struktur publik/cara run berubah.

## Verifikasi dan dependency

Jalankan dari root frontend sesuai perubahan:

```sh
npm ci                  # Setup dari lockfile; tidak perlu diulang setiap edit
npm run typecheck
npm run build
```

CI saat ini menjalankan typecheck dan build. Belum ada `npm test` atau
`npm run lint`; jangan mengklaim telah menjalankannya. Untuk perubahan UI,
periksa route terdampak di browser bila tersedia dan laporkan cakupannya.
Jika belum bisa, nyatakan keterbatasan tersebut.

Jika perubahan perilaku membutuhkan test otomatis, tambahkan runner minimal yang
relevan beserta script dan CI dalam perubahan tersebut. Prioritaskan user flow,
error state, dan integrasi; hindari test yang hanya mencerminkan JSX. Perubahan
dokumentasi/style ringan tidak memerlukan framework test baru.

Gunakan npm; perubahan dependency wajib menyertakan `package.json` dan
`package-lock.json`. Perbarui `.env.example`/README untuk konfigurasi baru.
Jangan commit `.env.local`, `node_modules`, `.next`, atau `tsconfig.tsbuildinfo`.
Perubahan kontrak API harus dikoordinasikan dengan repo backend dan tidak boleh
menampilkan seolah backend telah mendukung fitur yang belum tersedia.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
