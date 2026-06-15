# Phase 1 migration map — `public.odg_*` → `pm.*`

Status of each domain's backfill. **Legend:** ✅ written · ⚠️ needs a mapping
decision · 🔒 blocked on an ERP-table schema I can't introspect.

Apply in dependency order (FKs remap through `pm.<parent>.legacy_id`). Every
backfill is idempotent and transactional; apply on **staging first**.

| # | Domain | Source (legacy) | Target (pm) | Status | Blocker / note |
|---|--------|-----------------|-------------|--------|----------------|
| 1 | **projects** | `public.odg_projects` | `projects` (+ `project_status_history` TODO) | ✅ | `0000_projects.sql` (columns recovered from the app's `INSERT`; geo `"lat,lng"` split, ERP codes mapped). ⚠️ CONFIRM the status map for v2 pipeline-stage labels (default `in_progress`). `odg_project_status_history` audit log not yet backfilled (low priority). |
| 2 | **quotations** | `odg_quotation` | `quotations` + `quotation_lines` | ✅ | `0001_quotations.sql` |
| 3 | **contracts** | `odg_contract` + ERP `odg_projects_contract` + ERP `odg_projects_item` | `contracts` + `installments` + `installment_lines` | ✅ | `0004` (app header) · `0005` (ERP header, consolidated via `legacy_roworder`) · `0006` (installments from `odg_projects_item`). **Dropped by pm design** (confirm OK): contract LINE items — `odg_contract.items` and `odg_projects_contract_detail` (pm keeps an installment schedule, not line items). |
| 4 | **boq** | ERP `odg_projects_boq` (+ `_detail`) | `boq_docs` + `boq_lines` | ✅ | `0007_boq.sql` (columns recovered from `app/_actions/boq.ts`; `contract_id`→`pm.contracts.legacy_roworder`). |
| 5 | **surveys** | `odg_survey` | `surveys` | ✅ | `0003_surveys.sql` (dedupe on `(project_id, completed_date, surveyor)` — **recommend adding `legacy_id` to `pm.surveys`** for a robust key). |
| 6 | **tasks** | `odg_project_task` | `project_tasks` (new) | ✅ | `0010_tasks.sql`. New `pm.project_tasks` table added (migration `0001`); `work_order_id` links via `pm.work_orders.legacy_id`. |
| 7 | **work_orders** | `odg_work_order` (+ `odg_technicians`) | `work_orders` + `work_order_tasks` + `work_order_items` + `technicians` | ✅ | `0008` (technicians) + `0009` (work orders). **No data loss** — added `work_date/end_date/rate_per_hour/total_hours/labor_cost` + `legacy_id` to `pm.work_orders` (migration `0001`); `tasks`/`materials` JSONB split into the two child tables; technician resolved via `pm.technicians.code`. |
| 8 | **requests** | `odg_request` | `material_requests` + `material_request_lines` | ✅ | `0002_requests.sql` |

## Proposed status-enum maps (confirm before applying)

```
quotation_status:  ລໍຖ້າອະນຸມັດ→pending  ອະນຸມັດແລ້ວ→approved  ປະຕິເສດ→rejected   [used in 0001]
contract_status:   both approvals→active · sales only→awaiting_accounting ·
                   none→awaiting_sales · legacy 'draft'→draft               [NEEDS OK]
work_order_status: open→assigned · in_progress→in_progress · done→done ·
                   cancelled→cancelled                                       [NEEDS OK]
survey_status:     done→done · scheduled→scheduled · pending→pending ·
                   cancelled→cancelled (default done)                        [NEEDS OK]
project_status:    Lao labels → enum per app/_db/schema/_pm.ts header        [NEEDS OK]
```

## Done: `0000`–`0010` — ALL 8 domains ✅

All ERP/legacy columns were **recovered from the app's own SQL** (INSERT/SELECT
statements), so no live-DB introspection was needed. The two design gaps were
resolved by *adding* to the schema (migration `0001_motionless_tony_stark.sql`),
so **nothing is dropped**:
- `pm.work_orders` gained `legacy_id` + `work_date/end_date/rate_per_hour/total_hours/labor_cost`.
- new `pm.project_tasks` table for the project task plan.

Apply DDL `0000` then `0001`, then backfills `0000`→`0010` in order.

## Recommended schema tweaks (optional, for clean idempotency)

- Add `legacy_id integer unique` to `pm.surveys` (and `pm.installments`) so their
  backfills can use `ON CONFLICT` instead of the NOT-EXISTS heuristic.

## Confirmations (defaults already applied — change if wrong)

- Project status map for **v2 pipeline-stage** labels (default `in_progress`).
- Contract status derived from approval booleans (see `0004`/`0005`).
- Contract **line items dropped** (`odg_contract.items`,
  `odg_projects_contract_detail`) — pm keeps an installment schedule, not lines.

After the 2 decisions, the backfills are complete; then switch each action to the
Drizzle client (`app/_db/client.ts`) one domain at a time, mapping pm English
enums ↔ Lao labels at the action boundary so the UI stays unchanged.
