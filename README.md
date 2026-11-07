# CollectFlow

Next.js frontend for a lending collections portal. Built with the App Router, React, strict TypeScript, and responsive CSS. The English interface displays balances in Indonesian rupiah (IDR).

## Run locally

Requires Node.js 22+ (Node 24 recommended) and npm.

```sh
git clone https://github.com/Meefx/Hackathon-Frontend.git
cd Hackathon-Frontend
cp .env.example .env.local
npm ci
npm run dev
```

Open http://localhost:3000. Start the [FastAPI backend](https://github.com/Meefx/Hackathon-Backend) on http://localhost:8000 and run its explicit demo seed to populate the dashboard. The frontend reads the real local API; an unavailable backend displays a retry state.

`NEXT_PUBLIC_API_URL` configures the API origin. It is public browser configuration and must not contain credentials. Changes require restarting the dev server or rebuilding. Allow the frontend origin in the backend's `CORS_ORIGINS`.

## Included

- `/`: portfolio totals, overdue balances, and clickable aging buckets.
- `/accounts`: searchable account list, status filtering, and pagination.
- Account detail dialog with balance, due date, days past due, and ownership.
- Loading, empty, error, retry, and not-found states.
- Mobile layouts, keyboard navigation, and accessible native dialog.

## Checks and production build

```sh
npm run typecheck
npm run build
npm start
```

Dependencies are pinned in `package-lock.json`; use `npm ci` for reproducible installs. GitHub Actions runs the typecheck and production build on pushes and pull requests. Dependency installation requires npm registry access.

## Structure

```text
src/app/                         App Router pages and global styles
src/components/collection-workspace.tsx  Dashboard and account workspace
src/lib/api.ts                   Typed FastAPI client and formatting
public/                          Static assets
```

The backend's generated OpenAPI document is the contract source. Update the TypeScript interfaces when changing response models. This bootstrap provides read-only portfolio views; authentication, collection actions, and payment workflows are future work. Use fictional data during development.
