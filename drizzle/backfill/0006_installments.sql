-- ============================================================================
-- Phase 1 backfill — public.odg_projects_item  →  pm.installments + pm.installment_lines
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Staging first, verify, then production.
--
-- odg_projects_item is the ERP payment-installment schedule per contract:
--   (contract_no, installment_no, total_amount, items JSONB).
-- It maps to the normalised pm.installments (+ installment_lines from `items`).
--
-- PREREQUISITE: run AFTER pm.contracts is populated (0004 + 0005) — installments
-- link to pm.contracts by contract_no (INNER JOIN; FK is NOT NULL).
--
-- IDEMPOTENCY: pm.installments has no legacy_id; dedupe on (contract_id,
-- installment_no). due_date isn't present in the legacy row -> NULL.
--
-- ASSUMPTION (confirm): odg_projects_item.items is a JSONB array of
--   { description|name|item_name, amount }. Adjust the ->> keys if the real
--   shape differs.
-- ============================================================================

BEGIN;

-- 1) Installment headers ----------------------------------------------------
INSERT INTO pm.installments (contract_id, installment_no, total_amount, due_date, created_at)
SELECT
  ct.id,
  COALESCE(oi.installment_no, 1),
  COALESCE(oi.total_amount, 0),
  NULL::date,
  now()
FROM public.odg_projects_item oi
JOIN pm.contracts ct ON ct.contract_no = oi.contract_no
WHERE NOT EXISTS (
  SELECT 1 FROM pm.installments i2
  WHERE i2.contract_id = ct.id
    AND i2.installment_no = COALESCE(oi.installment_no, 1)
);

-- 2) Installment lines (from the legacy `items` JSONB) ----------------------
INSERT INTO pm.installment_lines (installment_id, line_no, description, amount)
SELECT
  inst.id,
  ln.ord::int,
  COALESCE(elem->>'description', elem->>'name', elem->>'item_name'),
  COALESCE(NULLIF(elem->>'amount', '')::numeric, 0)
FROM public.odg_projects_item oi
JOIN pm.contracts ct   ON ct.contract_no = oi.contract_no
JOIN pm.installments inst
  ON inst.contract_id = ct.id AND inst.installment_no = COALESCE(oi.installment_no, 1)
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(COALESCE(oi.items::jsonb, '[]'::jsonb)) = 'array'
       THEN oi.items::jsonb ELSE '[]'::jsonb END
) WITH ORDINALITY AS ln(elem, ord)
WHERE NOT EXISTS (SELECT 1 FROM pm.installment_lines l WHERE l.installment_id = inst.id);

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
-- SELECT
--   (SELECT count(*) FROM public.odg_projects_item) AS legacy,
--   (SELECT count(*) FROM pm.installments)          AS pm_installments,
--   (SELECT count(*) FROM pm.installment_lines)     AS pm_lines;
