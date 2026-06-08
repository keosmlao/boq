# ODG Project Management

Next.js App Router application for ODG project, BOQ, work order, and service workflows.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run lint
npm run build
npm run start
```

`npm run typecheck` is available for TypeScript cleanup work. It is not enforced in production build yet because several legacy screens still need type fixes.

## Environment

Set these values in `.env`:

- `NEXT_PUBLIC_API_BASE_URL=/api`
- `NEXT_PUBLIC_IMAGE_HOST=`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...`
- `DB_HOST=...`
- `DB_PORT=5432`
- `DB_NAME=...`
- `DB_USER=...`
- `DB_PASSWORD=...`

## Next.js Structure

- `app/(auth)` contains public auth pages such as login and unauthorized.
- `app/(dashboard)` contains authenticated app pages that use `Sidebar`, `TopBar`, and `PageHeaderProvider`.
- `app/(print)` contains print-only pages and must not import dashboard chrome.
- `app/api` contains Route Handlers. Prefer shared helpers from `app/_lib/http.ts`.
- `app/_components` contains reusable UI and shell components.
- `app/_screens` contains large client screens that are mounted by route pages.
- `app/_lib` contains server/data helpers and shared utilities.

## Migration Rules

- New pages should be server components by default and import a client screen only when needed.
- Print routes must live in `app/(print)`.
- Dashboard routes must live in `app/(dashboard)`.
- API responses should use `ok`, `fail`, and `serverError` from `app/_lib/http.ts`.
- Do not place business logic inside `page.tsx`; keep route pages thin.
- Do not add `.DS_Store`, build output, uploads, or environment files to git.

## TypeScript Cleanup Queue

Before `typescript.ignoreBuildErrors` can be disabled in `next.config.mjs`, fix the current `npm run typecheck` errors in these legacy areas:

- BOQ create/edit/print screens
- WorkOrders grouping types
- WorkSchedule route params
- Material/close print numeric props
- ManageTechnicians fetch response handling
