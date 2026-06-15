-- ============================================================================
-- Phase 1 backfill — public.odg_projects_boq(_detail)  →  pm.boq_docs + pm.boq_lines
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Staging first, verify, then production.
--
-- BOQ lives in the ERP tables odg_projects_boq / _detail (the retired odg_boq is
-- gone). Columns mapped from the boq action code (app/_actions/boq.ts).
--
-- PREREQUISITES (in order): projects (0000) and the ERP contracts (0005) — both
-- pm.boq_docs.project_id and .contract_id are NOT NULL, so this INNER-JOINs
-- pm.projects (legacy_id) and pm.contracts (legacy_roworder = boq.contract_id).
-- BOQ rows whose project/contract aren't migrated are skipped (re-run later).
--
-- Idempotent: boq_docs via doc_no (UNIQUE); boq_lines via NOT EXISTS.
-- STATUS MAP: approve_status 1->approved, 2->rejected, else pending.
-- ============================================================================

BEGIN;

-- 1) BOQ headers ------------------------------------------------------------
INSERT INTO pm.boq_docs (
  doc_no, doc_date, project_id, contract_id, customer_code, created_by,
  status, approver, created_at, updated_at
)
SELECT
  b.doc_no,
  COALESCE(b.doc_date, CURRENT_DATE),
  p.id,
  ct.id,
  b.cust_code,
  b.user_created,
  (CASE COALESCE(b.approve_status, 0) WHEN 1 THEN 'approved' WHEN 2 THEN 'rejected' ELSE 'pending' END)::pm.approval_status,
  b.approver,
  COALESCE(b.doc_date::timestamptz, now()),
  now()
FROM public.odg_projects_boq b
JOIN pm.projects p
  ON b.project_id::text ~ '^[0-9]+$' AND p.legacy_id = b.project_id::text::int
JOIN pm.contracts ct
  ON b.contract_id::text ~ '^[0-9]+$' AND ct.legacy_roworder = b.contract_id::text::int
WHERE b.doc_no IS NOT NULL
ON CONFLICT (doc_no) DO NOTHING;

-- 2) BOQ lines --------------------------------------------------------------
INSERT INTO pm.boq_lines (boq_id, line_no, item_code, item_name, unit_code, qty)
SELECT
  bdoc.id,
  (row_number() OVER (PARTITION BY bd.doc_no ORDER BY bd.roworder))::int,
  COALESCE(NULLIF(bd.item_code, ''), 'UNKNOWN'),
  bd.item_name,
  bd.unit_code,
  COALESCE(bd.qty, 0)
FROM public.odg_projects_boq_detail bd
JOIN pm.boq_docs bdoc ON bdoc.doc_no = bd.doc_no
WHERE NOT EXISTS (SELECT 1 FROM pm.boq_lines l WHERE l.boq_id = bdoc.id);

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
-- SELECT
--   (SELECT count(*) FROM public.odg_projects_boq)        AS legacy_headers,
--   (SELECT count(*) FROM pm.boq_docs)                    AS pm_headers,
--   (SELECT count(*) FROM pm.boq_lines)                   AS pm_lines;
