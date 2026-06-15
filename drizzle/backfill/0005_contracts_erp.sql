-- ============================================================================
-- Phase 1 backfill — public.odg_projects_contract (ERP)  →  pm.contracts
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Staging first, verify, then production.
--
-- This is the SECOND source that consolidates into pm.contracts (the first is
-- the app-owned odg_contract in 0004). Idempotent via legacy_roworder; we also
-- skip any contract_no already present (so it never collides with an app
-- contract from 0004 on the UNIQUE contract_no).
--
-- PREREQUISITES (in order): projects (NOT NULL FK → INNER JOIN), then quotations
-- (so quotation_id links resolve). Run AFTER 0004.
--
-- NOT covered here:
--   * odg_projects_contract_detail (per-product line items: item_name, amount,
--     paymentfrequency, averageperpayment) — pm.contracts has no line-items
--     table, so these are DROPPED (same pm design choice as odg_contract.items).
--   * Installment schedule (odg_projects_item) -> see 0006_installments.sql.
--
-- STATUS MAP (from ERP approval ints; CONFIRM):
--   approve_status_1 = sales · GREATEST(approve_status_2, acc_approve) = accounting
--   both -> active | sales only -> awaiting_accounting | else -> awaiting_sales
-- ============================================================================

BEGIN;

INSERT INTO pm.contracts (
  legacy_roworder, contract_no, name, project_id, quotation_id,
  customer_code, customer_name,
  currency_code, amount, payment_type, brand,
  sign_date, start_date, end_date,
  sales_approved, accounting_approved,
  status, created_at, updated_at
)
SELECT
  c.roworder,
  c.contract_no,
  c.contract_name,
  p.id,
  (SELECT q.id FROM pm.quotations q
     WHERE c.quotation_id ~ '^[0-9]+$' AND q.legacy_id = c.quotation_id::int LIMIT 1),
  c.cust_code,
  ac.name_1,
  COALESCE(NULLIF(c.currency_code, ''), 'LAK'),
  COALESCE(c.amount, 0),
  c.payment_type,
  c.brand,
  c.contract_date,
  c.start_date,
  c.end_date,
  (COALESCE(c.approve_status_1, 0) = 1),
  (GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1),
  (CASE
     WHEN COALESCE(c.approve_status_1, 0) = 1
      AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1 THEN 'active'
     WHEN COALESCE(c.approve_status_1, 0) = 1 THEN 'awaiting_accounting'
     ELSE 'awaiting_sales'
   END)::pm.contract_status,
  COALESCE(c.created_at, now()),
  COALESCE(c.created_at, now())
FROM public.odg_projects_contract c
JOIN pm.projects p
  ON c.project_id::text ~ '^[0-9]+$' AND p.legacy_id = c.project_id::int
LEFT JOIN public.ar_customer ac ON ac.code = c.cust_code
WHERE c.contract_no IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pm.contracts pc WHERE pc.contract_no = c.contract_no)
ON CONFLICT (legacy_roworder) DO NOTHING;

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
-- SELECT
--   (SELECT count(*) FROM public.odg_projects_contract)               AS legacy_erp,
--   (SELECT count(*) FROM pm.contracts WHERE legacy_roworder IS NOT NULL) AS pm_erp_contracts,
--   (SELECT count(*) FROM pm.contracts)                               AS pm_total_contracts;
