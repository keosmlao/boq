# Phase 1 — data backfill (legacy `public.odg_*` → `pm.*`)

These SQL files move data from the legacy tables into the rebuilt `pm.*` schema.
They are **deliberate, manually-applied** artifacts — the app never runs them and
they are **not** applied automatically. Apply on **staging first**, verify, then
run in a production cut-over window.

## Ordered cut-over checklist

1. **DDL** — apply, in order, the generated migrations (offline `drizzle-kit
   generate`; never `push` to a live DB):
   - `drizzle/0000_sudden_meltdown.sql` — base `pm.*` tables/enums
   - `drizzle/0001_motionless_tony_stark.sql` — adds `pm.project_tasks` and the
     `pm.work_orders` scheduling/labour columns (additive only, no `DROP`)
2. **Backfill, in dependency order** (each is idempotent — safe to re-run).
   Per-domain status, transforms and blockers are in **MIGRATION-MAP.md**:
   - [x] `0000_projects.sql`        (root — RUN FIRST)
   - [x] `0001_quotations.sql`
   - [x] `0002_requests.sql`
   - [x] `0003_surveys.sql`
   - [x] `0004_contracts.sql`       (app-owned contract header)
   - [x] `0005_contracts_erp.sql`   (ERP contract header → same pm.contracts)
   - [x] `0006_installments.sql`    (ERP odg_projects_item → installments + lines)
   - [x] `0007_boq.sql`             (ERP odg_projects_boq(_detail) → boq_docs + lines)
   - [x] `0008_technicians.sql`     (odg_technicians → technicians)
   - [x] `0009_work_orders.sql`     (odg_work_order → work_orders + tasks + items)
   - [x] `0010_tasks.sql`           (odg_project_task → project_tasks)

   > **All 8 domains done.** Apply in numeric order (0000 → 0010). Each is
   > idempotent; later files INNER-JOIN / NULL-out rows whose parent isn't
   > migrated yet, so a clean sequential run links everything.
3. **Verify** — run the reconciliation `SELECT`s at the bottom of each file;
   counts on both sides should match.
4. **Cut over the read/write path** — only after a domain is backfilled & verified,
   switch its action in `app/_actions/*` from raw `query()` to the Drizzle client
   (`app/_db/client.ts`). Keep the existing function signatures and the Lao status
   labels the UI expects (map `pm` English enums ↔ Lao at the action boundary) so
   the swap is a drop-in with no UI changes.

   **Drop-in actions (all type-checked, NOT wired in):** one `*.pm.ts` per domain
   in `app/_actions/`, each mirroring the legacy action's API (status enum ↔ Lao,
   children rebuilt from line tables, ids resolve pm-or-legacy). At cut-over, point
   the UI imports at the `.pm` module (or rename it over the original):
   - `quotations.pm.ts`  — full
   - `survey.pm.ts`      — full
   - `tasks-v2.pm.ts`    — full (schedule auto-recreate crutch dropped)
   - `request-v2.pm.ts`  — full (withdrawals come from ERP ic_trans — port that read)
   - `contracts.pm.ts`   — full (line items/discount/tax dropped by pm design)
   - `workorder.pm.ts`   — full (old "erp-N" WO system stubbed)
   - `boq.pm.ts`         — reads + approve/delete + materials (saveBoq/ERP-write fns: port)
   - `projects.pm.ts`    — list + stage + delete (getProjectsBoq/detail/create: port)

## Safety

- `pm.*` is additive — legacy `public.odg_*` tables stay untouched, so the running
  app keeps working until each domain is deliberately cut over.
- Do **not** switch an action to `pm.*` before its data is backfilled — `pm` tables
  start empty and the page would show nothing.
- Run everything inside a transaction (the files already `BEGIN; … COMMIT;`).
