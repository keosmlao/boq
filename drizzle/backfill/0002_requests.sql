-- ============================================================================
-- Phase 1 backfill — public.odg_request  →  pm.material_requests + pm.material_request_lines
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Not run by the app. Staging first, verify, then
-- production cut-over. See README.md / MIGRATION-MAP.md.
--
-- PREREQUISITES: apply drizzle/0000 DDL; backfill pm.projects first so
-- project_id links resolve (otherwise NULL — re-run later to link).
--
-- Source is the APP-OWNED v2 table odg_request (ໃບຂໍ). ERP/legacy odg_requests
-- (mirrored into ic_trans) stays in the ERP and is NOT migrated here.
--
-- STATUS MAP: legacy status 'withdrawn' -> fulfilled=true, else fulfilled=false.
-- ============================================================================

BEGIN;

-- 1) Request headers --------------------------------------------------------
INSERT INTO pm.material_requests (
  doc_no, doc_date, project_id, requester_name, remark, fulfilled, created_at, updated_at
)
SELECT
  oq.request_no,
  COALESCE(oq.created_at::date, CURRENT_DATE),
  (SELECT p.id FROM pm.projects p
     WHERE oq.project_id ~ '^[0-9]+$' AND p.legacy_id = oq.project_id::int
     LIMIT 1),
  oq.requester,
  oq.notes,
  (oq.status = 'withdrawn'),
  COALESCE(oq.created_at, now()),
  COALESCE(oq.updated_at, now())
FROM public.odg_request oq
WHERE oq.request_no IS NOT NULL
ON CONFLICT (doc_no) DO NOTHING;

-- 2) Request line items (normalised out of the legacy `items` JSONB) ---------
INSERT INTO pm.material_request_lines (
  request_id, line_no, item_code, item_name, unit_code, qty, remark
)
SELECT
  mr.id,
  ln.ord::int,
  elem->>'item_code',
  COALESCE(elem->>'item_name', elem->>'description'),
  COALESCE(elem->>'unit_code', elem->>'unit'),
  COALESCE(NULLIF(elem->>'qty', '')::numeric, 0),
  elem->>'remark'
FROM public.odg_request oq
JOIN pm.material_requests mr ON mr.doc_no = oq.request_no
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(COALESCE(oq.items::jsonb, '[]'::jsonb)) = 'array'
       THEN oq.items::jsonb ELSE '[]'::jsonb END
) WITH ORDINALITY AS ln(elem, ord)
WHERE NOT EXISTS (SELECT 1 FROM pm.material_request_lines l WHERE l.request_id = mr.id);

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
-- SELECT
--   (SELECT count(*) FROM public.odg_request WHERE request_no IS NOT NULL) AS legacy,
--   (SELECT count(*) FROM pm.material_requests)                            AS pm_headers,
--   (SELECT count(*) FROM pm.material_request_lines)                       AS pm_lines;
