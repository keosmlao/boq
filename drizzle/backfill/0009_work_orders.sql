-- ============================================================================
-- Phase 1 backfill — public.odg_work_order  →  pm.work_orders (+ tasks + items)
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Staging first, verify, then production.
--
-- PREREQUISITES: 0000 projects, 0004/0005 contracts, 0008 technicians.
-- Requires the schema additions in drizzle/0001_motionless_tony_stark.sql
-- (pm.work_orders.legacy_id + work_date/end_date/rate_per_hour/total_hours/
-- labor_cost). No data is dropped — the legacy financial+date fields now land.
--
-- Idempotent via legacy_id. status: open->assigned, in_progress->in_progress,
-- paused->paused, done->done, cancelled->cancelled (default assigned).
-- tasks JSONB -> work_order_tasks; materials JSONB -> work_order_items.
-- ============================================================================

BEGIN;

-- 1) Work-order headers -----------------------------------------------------
INSERT INTO pm.work_orders (
  legacy_id, code, project_id, contract_id, technician_id,
  status, priority, work_date, end_date, rate_per_hour, total_hours, labor_cost,
  created_by, created_at, updated_at
)
SELECT
  w.id,
  COALESCE(NULLIF(w.work_no, ''), 'WO-LEGACY-' || w.id),
  (SELECT p.id FROM pm.projects p WHERE w.project_id ~ '^[0-9]+$' AND p.legacy_id = w.project_id::int LIMIT 1),
  (SELECT ct.id FROM pm.contracts ct
     WHERE w.contract_id::text ~ '^[0-9]+$'
       AND (ct.legacy_roworder = w.contract_id::text::int OR ct.legacy_contract_id = w.contract_id::text::int)
     LIMIT 1),
  (SELECT tc.id FROM pm.technicians tc WHERE tc.code = w.technician_code LIMIT 1),
  (CASE w.status
     WHEN 'open' THEN 'assigned'
     WHEN 'in_progress' THEN 'in_progress'
     WHEN 'paused' THEN 'paused'
     WHEN 'done' THEN 'done'
     WHEN 'cancelled' THEN 'cancelled'
     ELSE 'assigned'
   END)::pm.work_order_status,
  'normal'::pm.work_order_priority,
  w.work_date, w.end_date,
  COALESCE(w.rate_per_hour, 0), COALESCE(w.total_hours, 0), COALESCE(w.labor_cost, 0),
  w.technician_name,
  COALESCE(w.created_at, now()), COALESCE(w.created_at, now())
FROM public.odg_work_order w
ON CONFLICT (legacy_id) DO NOTHING;

-- 2) Selected tasks (from the `tasks` JSONB) --------------------------------
INSERT INTO pm.work_order_tasks (work_order_id, task_id, task_name, sort_order)
SELECT
  wo.id,
  CASE WHEN elem->>'id' ~ '^[0-9]+$' THEN (elem->>'id')::int END,
  COALESCE(elem->>'title', elem->>'task_name'),
  ln.ord::int
FROM public.odg_work_order w
JOIN pm.work_orders wo ON wo.legacy_id = w.id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(COALESCE(w.tasks::jsonb, '[]'::jsonb)) = 'array' THEN w.tasks::jsonb ELSE '[]'::jsonb END
) WITH ORDINALITY AS ln(elem, ord)
WHERE NOT EXISTS (SELECT 1 FROM pm.work_order_tasks x WHERE x.work_order_id = wo.id);

-- 3) Planned materials (from the `materials` JSONB) -------------------------
INSERT INTO pm.work_order_items (work_order_id, item_code, item_name, unit_code, qty)
SELECT
  wo.id,
  elem->>'item_code',
  COALESCE(elem->>'item_name', elem->>'description'),
  COALESCE(elem->>'unit_code', elem->>'unit'),
  COALESCE(NULLIF(elem->>'qty', '')::numeric, 0)
FROM public.odg_work_order w
JOIN pm.work_orders wo ON wo.legacy_id = w.id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(COALESCE(w.materials::jsonb, '[]'::jsonb)) = 'array' THEN w.materials::jsonb ELSE '[]'::jsonb END
) WITH ORDINALITY AS ln(elem, ord)
WHERE NOT EXISTS (SELECT 1 FROM pm.work_order_items x WHERE x.work_order_id = wo.id);

COMMIT;

-- SELECT (SELECT count(*) FROM public.odg_work_order) AS legacy,
--        (SELECT count(*) FROM pm.work_orders)        AS pm_headers,
--        (SELECT count(*) FROM pm.work_order_tasks)   AS pm_tasks,
--        (SELECT count(*) FROM pm.work_order_items)   AS pm_items;
