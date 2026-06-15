-- ============================================================================
-- Phase 1 backfill — public.odg_project_task  →  pm.project_tasks
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Staging first, verify, then production.
--
-- PREREQUISITES: 0000 projects, 0009 work_orders (a task links to the work order
-- it was pulled into). Requires the new pm.project_tasks table from
-- drizzle/0001_motionless_tony_stark.sql. Idempotent via legacy_id.
-- ============================================================================

BEGIN;

INSERT INTO pm.project_tasks (
  legacy_id, project_id, legacy_contract_ref, task_code, title, phase,
  technician_code, technician_name, planned_start, planned_end,
  est_days, est_hours, actual_hours, work_order_id, status, sort_order, created_at
)
SELECT
  t.id,
  (SELECT p.id FROM pm.projects p WHERE t.project_id ~ '^[0-9]+$' AND p.legacy_id = t.project_id::int LIMIT 1),
  NULLIF(t.contract_id, ''),
  t.task_code,
  COALESCE(NULLIF(t.title, ''), 'ໜ້າວຽກ'),
  t.phase,
  t.technician_code,
  t.technician_name,
  t.planned_start,
  t.planned_end,
  COALESCE(t.est_days, 0),
  COALESCE(t.est_hours, 0),
  COALESCE(t.actual_hours, 0),
  (SELECT wo.id FROM pm.work_orders wo WHERE t.work_order_id ~ '^[0-9]+$' AND wo.legacy_id = t.work_order_id::int LIMIT 1),
  COALESCE(NULLIF(t.status, ''), 'planned'),
  COALESCE(t.sort_order, 0),
  COALESCE(t.created_at, now())
FROM public.odg_project_task t
ON CONFLICT (legacy_id) DO NOTHING;

COMMIT;

-- SELECT (SELECT count(*) FROM public.odg_project_task) AS legacy,
--        (SELECT count(*) FROM pm.project_tasks)        AS pm_tasks,
--        (SELECT count(*) FROM pm.project_tasks WHERE work_order_id IS NOT NULL) AS linked_to_wo;
