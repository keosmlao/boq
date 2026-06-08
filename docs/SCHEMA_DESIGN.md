# Rebuild — Schema Design (Phase 0)

Status: **Phase 0 (foundation) — schema authored, migration SQL generated, nothing applied to the live DB yet.**

This document records the target data model for the rebuild and how it maps from
the legacy schema. Decisions approved: keep Next.js 15 + React 19 + Tailwind v4,
add **Drizzle ORM**; **new clean tables + migrate + cut over**; priority is
**clean, consistent code + schema**.

---

## 1. Guiding principles

1. **The app does not own everything.** A large part of the data lives in
   external ERP tables that other systems write. Those are off-limits — we model
   them read-only and keep every integration contract intact.
2. **Additive, not destructive.** All new tables live in a dedicated Postgres
   schema `pm`. Legacy `public.odg_*` tables stay exactly as they are until cut-over.
   `drizzle.config.ts` uses `schemaFilter: ["pm"]`, so drizzle-kit can never emit
   DDL against `public`/ERP.
3. **Real keys, real types.** Surrogate `bigserial id` PKs, real foreign keys,
   `numeric(18,2)` for money, `boolean` for flags, enums for status — replacing
   `roworder` PKs, `::int` casts on text columns, and integer status soup.
4. **One model per concept.** The two parallel contract tables collapse into one.

---

## 1b. Confirmed business process (canonical pipeline)

The system sells & installs projects. Confirmed stages (drives navigation + status):

1. **Register project** (ລົງທະບຽນໂຄງການ)
2. **Survey** (ສຳຫຼວດ) — site visit before pricing → `pm.surveys`
3. **Quotation** (ສະເໜີລາຄາ) — create + approve → `pm.quotations`
4. **Contract** (ສັນຍາ) — created **from an approved quotation**; approved by **two** roles: Sales Manager + Accounting → `pm.contracts` (`sales_approved` + `accounting_approved`)
5. **BOQ** (ຈາກສັນຍາ) — create + approve → `pm.boq_docs`
6. **Task plan** (ກຳນົດໜ້າວຽກ, from contract) → `pm.work_schedule`
7. **Work order** (ໃບງານ) — pulls **tasks** (`work_order_tasks`) **+ BOQ lines** (`work_order_items`) → `pm.work_orders`
8. **Material request** (ຂໍເບີກ) — raised **from a BOQ** or **from a work order's needs** (`material_requests.boq_id` / `work_order_id`); mirrored to ERP `ic_trans`.

---

## 2. Ownership map

### Redesigned → `pm.*` (app-owned)

| New (`pm`) | Legacy source(s) |
| --- | --- |
| `projects` | `public.odg_projects` |
| `project_status_history` | `public.odg_project_status_history` |
| `project_attachments` | `public.odg_project_request_attachments` |
| `quotations`, `quotation_lines` | `public.odg_quotation` (+ its `items` JSONB) |
| **`contracts`** | **`public.odg_projects_contract` + `public.odg_contract` (merged)** |
| `installments`, `installment_lines` | `public.odg_projects_item` (+ its `items` JSONB) |
| `boq_docs`, `boq_lines` | `public.odg_projects_boq` + `odg_projects_boq_detail` |
| `material_requests`, `material_request_lines` | `public.odg_requests` + `odg_requests_detail` |
| `work_orders` (+ `_tasks`, `_logs`, `_checkins`, `_materials`) | `public.odg_work_order*` |
| `work_schedule` | `public.odg_work_schedule` |
| `technicians` | `public.odg_technicians` |

### Off-limits → modelled read-only in `app/_db/erp` (NOT migrated, NOT in `pm`)

`erp_province`, `erp_amper`, `erp_tambon` (geo) · `ic_inventory`, `ic_warehouse`,
`ic_shelf`, `ic_wh_shelf` (inventory) · `biotime_employee` (HR) ·
`odg_project_manager_user` (login) · `odg_project_business_type` /
`_business_model` / `odg_project_type` / `odg_task_master` (lookups) ·
`odg_withdraw_info` (warehouse-side).

**Special case — ERP write mirror:** `ic_trans` / `ic_trans_detail`. The material
request action mirrors each request into these (`trans_type=3`, `trans_flag=122`,
shared `doc_no`). This is an ERP-owned write contract — it stays in the action
layer and its shape must not change.

---

## 3. Key model decisions

### 3.1 One contract model
Legacy had `odg_projects_contract` (ERP-style, PK `roworder`, drove BOQ) **and**
`odg_contract` (newer quotation→contract, PK `id`, JSONB items) — never joined.
`pm.contracts` unifies them. `legacy_roworder` and `legacy_contract_id` preserve
both source keys for migration + traceability.

### 3.2 Approvals as explicit columns
`approve_status_1` / `approve_status_2` / `acc_approve` (ints) →
`sales_approved` / `accounting_approved` booleans, each with `*_approver` and
`*_approved_at`. The legacy `isApproved` rule
(`approve_status_1==1 AND max(approve_status_2, acc_approve)==1`) becomes
`sales_approved AND accounting_approved`.

### 3.3 Status enums (English keys, Lao labels in UI)
`project_status`, `contract_status`, `quotation_status`, `approval_status`,
`work_order_status`, `work_order_priority`, `technician_role` are pg enums in `pm`.
Internal values are English; the Lao labels render in the UI layer. Project status
mapping:

| enum | Lao label |
| --- | --- |
| `pending` | ລໍຖ້າດຳເນີນ |
| `in_progress` | ຂັ້ນຕອນດຳເນີນໂຄງການ |
| `ready_to_withdraw` | ສາມາດເບີກຂອງໃດ້ |
| `installing` | ດຳເນີນການຕິດຕັ້ງ |
| `pending_close` | ລໍຖ້າອະນຸມັດປິດໂຄງການ |
| `closed` | ປິດໂຄງການ |
| `cancelled` | ຍົກເລີກ |

### 3.4 JSONB arrays → child tables
`odg_quotation.items` → `quotation_lines`; `odg_projects_item.items` →
`installment_lines`. Queryable, typed, indexable.

### 3.5 Real foreign keys instead of `::int` casts
BOQ/requests/contracts link by integer FKs to `projects.id` / `contracts.id`.
This eliminates the `c.project_id::int = p.id` crash class that produced the
"0/0 ສັນຍາ" bug.

### 3.6 Geo split
`odg_projects.office_lg` / `project_lg` ("lat,lng" strings) →
`office_lat`/`office_lng` + `project_lat`/`project_lng` (`double precision`).

---

## 4. Workflow / commands

```bash
# Generate migration SQL from the schema (OFFLINE — no DB connection):
node --env-file=.env ./node_modules/.bin/drizzle-kit generate

# Output: drizzle/0000_pm_initial.sql  (creates schema pm + 7 enums + 19 tables)
```

**Do NOT run `drizzle-kit push`** against the live database. The generated SQL is
applied deliberately during the Phase 1 cut-over (create `pm` schema → run data
migration scripts → verify side-by-side → switch the app over).

---

## 5. Roadmap

- **Phase 0 (this) — Foundation:** Drizzle + `pm` schema + ERP read models + this doc. ✅
- **Phase 1 — Migration:** scripts to copy `public.odg_*` → `pm.*` (status-string → enum mapping, JSONB → lines, geo split, contract merge), run on a copy first.
- **Phase 2..N — Modules on the new foundation:** Auth/RBAC (move role checks into middleware) → Projects → Quotations/Contracts → BOQ → Requests → Work Orders → Dashboards. Each module: typed Drizzle queries + refreshed UI from the design system.
- **Cut-over:** run both schemas in parallel, verify, switch reads/writes to `pm`, retire legacy.
