-- Unify contracts onto the ERP table (odg_projects_contract) as the source of truth.
--
-- Background: the app historically had two contract tables — odg_contract (v2)
-- and odg_projects_contract (ERP). createContract now writes ERP directly and
-- saveBoq bridges leftovers at runtime, but older projects may still have a v2
-- contract with NO matching ERP row, which blocks BOQ creation.
--
-- This migration is ADDITIVE & IDEMPOTENT — it never updates or deletes existing
-- rows. It copies each v2 contract that has no ERP counterpart (same project_id)
-- into odg_projects_contract (+ detail). Safe to run repeatedly.
--
-- ⚠️ Take a DB backup before running in production. Review the row counts in the
--    two SELECTs at the bottom first, then run inside the transaction.

BEGIN;

-- 1) Header rows: v2 contracts whose project has no ERP contract yet.
INSERT INTO public.odg_projects_contract
  (project_id, quotation_id, contract_name, contract_no, contract_date, cust_code,
   amount, start_date, end_date, approve_status_1, approve_status_2, acc_approve, created_at)
SELECT
  c.project_id,
  c.quotation_id,
  c.project_name,
  c.contract_no,
  COALESCE(c.sign_date, c.created_at),
  p.sml_code,
  COALESCE(c.total_amount, 0),
  c.start_date,
  c.end_date,
  0, 0, 0,
  COALESCE(c.created_at, now())
FROM public.odg_contract c
LEFT JOIN public.odg_projects p ON p.id::text = c.project_id::text
WHERE c.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.odg_projects_contract e
     WHERE e.project_id::text = c.project_id::text
  );

-- 2) Detail rows: line items for the contracts we just bridged (match by contract_no
--    and only when that ERP contract currently has no detail).
INSERT INTO public.odg_projects_contract_detail
  (project_id, contract_date, item_code, item_name, amount, created_date_time_now, contract_no)
SELECT
  c.project_id,
  now(),
  NULLIF(it->>'item_code', ''),
  COALESCE(it->>'description', it->>'item_name', ''),
  COALESCE((it->>'total')::numeric, (it->>'qty')::numeric * (it->>'unit_price')::numeric, 0),
  now(),
  c.contract_no
FROM public.odg_contract c
-- Cast to jsonb first so this works whether `items` is stored as jsonb or text.
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN c.items IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(c.items::jsonb) = 'array' THEN c.items::jsonb
    ELSE '[]'::jsonb
  END
) AS it
WHERE c.project_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.odg_projects_contract e WHERE e.contract_no = c.contract_no)
  AND NOT EXISTS (SELECT 1 FROM public.odg_projects_contract_detail d WHERE d.contract_no = c.contract_no);

-- Verify (read-only) — uncomment to inspect before COMMIT:
-- SELECT count(*) AS v2_total FROM public.odg_contract;
-- SELECT count(*) AS erp_total FROM public.odg_projects_contract;

COMMIT;
