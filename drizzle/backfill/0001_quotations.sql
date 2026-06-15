-- ============================================================================
-- Phase 1 backfill — public.odg_quotation  →  pm.quotations + pm.quotation_lines
-- ============================================================================
-- This is a DELIBERATE, MANUALLY-APPLIED migration artifact. It is NOT run by
-- the app and NOT applied automatically. Review it, run it on a STAGING copy
-- first, verify the counts at the bottom, THEN apply to production during the
-- cut-over window.
--
-- PREREQUISITES (run in this order):
--   1. Apply the schema DDL once:  drizzle/0000_sudden_meltdown.sql  (creates pm.*)
--   2. Backfill pm.projects FIRST  — quotation.project_id is remapped through
--      pm.projects.legacy_id below; quotations whose project isn't in pm yet
--      simply get project_id = NULL (the FK is nullable) and can be re-linked
--      by re-running this script after projects are backfilled.
--
-- SAFETY:
--   * Idempotent: re-running inserts nothing new (ON CONFLICT / NOT EXISTS).
--   * Wrapped in a single transaction — all-or-nothing.
--   * Touches ONLY the new pm.* tables. Legacy public.odg_quotation is read-only
--     here and left completely untouched (additive migration).
--
-- STATUS MAP (legacy Lao label -> pm.quotation_status enum):
--   ອະນຸມັດແລ້ວ -> approved | ປະຕິເສດ -> rejected | (everything else) -> pending
-- ============================================================================

BEGIN;

-- 1) Quotation headers ------------------------------------------------------
INSERT INTO pm.quotations (
  legacy_id, quotation_no, project_id,
  customer_name, customer_address, customer_phone,
  quotation_date, validity_date, terms, notes,
  discount, tax, tax_type, subtotal, total_amount,
  status, created_at, updated_at
)
SELECT
  oq.id,
  oq.quotation_no,
  (SELECT p.id FROM pm.projects p
     WHERE oq.project_id ~ '^[0-9]+$' AND p.legacy_id = oq.project_id::int
     LIMIT 1),
  oq.customer_name,
  oq.customer_address,
  oq.customer_phone,
  oq.quotation_date,
  oq.validity_date,
  oq.terms,
  oq.notes,
  COALESCE(oq.discount, 0),
  COALESCE(oq.tax, 0),
  COALESCE(NULLIF(oq.tax_type, ''), '0'),
  COALESCE(oq.subtotal, 0),
  COALESCE(oq.total_amount, 0),
  (CASE oq.status
     WHEN 'ອະນຸມັດແລ້ວ' THEN 'approved'
     WHEN 'ປະຕິເສດ'   THEN 'rejected'
     ELSE 'pending'
   END)::pm.quotation_status,
  COALESCE(oq.created_at, now()),
  COALESCE(oq.updated_at, now())
FROM public.odg_quotation oq
WHERE oq.quotation_no IS NOT NULL
ON CONFLICT (legacy_id) DO NOTHING;

-- 2) Quotation line items (normalised out of the legacy `items` JSONB) -------
INSERT INTO pm.quotation_lines (
  quotation_id, line_no, item_code, description, unit_code, qty, unit_price, amount, remark
)
SELECT
  q.id,
  ln.ord::int,
  elem->>'item_code',
  COALESCE(elem->>'description', elem->>'item_name'),
  COALESCE(elem->>'unit', elem->>'unit_code'),
  COALESCE(NULLIF(elem->>'qty', '')::numeric, 0),
  COALESCE(NULLIF(elem->>'unit_price', '')::numeric, 0),
  COALESCE(
    NULLIF(elem->>'amount', '')::numeric,
    NULLIF(elem->>'qty', '')::numeric * NULLIF(elem->>'unit_price', '')::numeric,
    0
  ),
  elem->>'remark'
FROM public.odg_quotation oq
JOIN pm.quotations q ON q.legacy_id = oq.id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(COALESCE(oq.items::jsonb, '[]'::jsonb)) = 'array'
       THEN oq.items::jsonb ELSE '[]'::jsonb END
) WITH ORDINALITY AS ln(elem, ord)
WHERE NOT EXISTS (SELECT 1 FROM pm.quotation_lines l WHERE l.quotation_id = q.id);

COMMIT;

-- ── Verification (run after COMMIT; both sides should reconcile) ────────────
-- SELECT
--   (SELECT count(*) FROM public.odg_quotation WHERE quotation_no IS NOT NULL) AS legacy_headers,
--   (SELECT count(*) FROM pm.quotations)                                       AS pm_headers,
--   (SELECT count(*) FROM pm.quotation_lines)                                  AS pm_lines,
--   (SELECT count(*) FROM pm.quotations WHERE project_id IS NULL)              AS unlinked_projects;
