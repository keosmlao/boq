-- ============================================================================
-- Phase 1 backfill — public.odg_contract  →  pm.contracts  (HEADER only)
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Staging first, verify, then production.
--
-- SCOPE: migrates the APP-OWNED contract header (public.odg_contract, the
-- newer quotation->contract table). NOT covered here:
--   * pm.installments / installment_lines  -> come from the ERP table
--     public.odg_projects_item (separate backfill, blocked on its schema).
--   * odg_contract.items (contract LINE items) -> pm.contracts has no line-items
--     table by design (it keeps an installment schedule instead), so these are
--     intentionally DROPPED. CONFIRM this is acceptable.
--   * ERP contracts (public.odg_projects_contract, PK roworder) -> map onto the
--     SAME pm.contracts via legacy_roworder (separate backfill, blocked on schema).
--
-- PREREQUISITE: backfill pm.projects FIRST — pm.contracts.project_id is NOT NULL,
-- so this INNER-JOINs pm.projects on legacy_id. Run pm.quotations first too so
-- quotation_id links resolve (else NULL). Idempotent via legacy_contract_id.
--
-- STATUS MAP (derived from approval booleans; CONFIRM):
--   both approved -> active | sales only -> awaiting_accounting
--   legacy 'draft' -> draft | otherwise -> awaiting_sales
-- ============================================================================

BEGIN;

INSERT INTO pm.contracts (
  legacy_contract_id, contract_no, name, project_id, quotation_id,
  customer_name, customer_address, customer_phone,
  currency_code, amount, payment_type,
  sign_date, start_date, end_date,
  sales_approved, sales_approver, accounting_approved, accounting_approver,
  status, notes, pdf_url, created_at, updated_at
)
SELECT
  oc.id,
  oc.contract_no,
  oc.project_name,                                  -- legacy has no contract name; use project_name as label
  p.id,
  (SELECT q.id FROM pm.quotations q WHERE q.legacy_id = oc.quotation_id LIMIT 1),
  oc.customer_name, oc.customer_address, oc.customer_phone,
  'LAK',
  COALESCE(oc.total_amount, 0),
  oc.payment_terms,
  oc.sign_date, oc.start_date, oc.end_date,
  COALESCE(oc.sales_approved, false),      oc.sales_approver,
  COALESCE(oc.accounting_approved, false), oc.accounting_approver,
  (CASE
     WHEN COALESCE(oc.sales_approved, false) AND COALESCE(oc.accounting_approved, false) THEN 'active'
     WHEN COALESCE(oc.sales_approved, false) THEN 'awaiting_accounting'
     WHEN oc.status = 'draft' THEN 'draft'
     ELSE 'awaiting_sales'
   END)::pm.contract_status,
  oc.notes, oc.contract_pdf_url,
  COALESCE(oc.created_at, now()), COALESCE(oc.updated_at, now())
FROM public.odg_contract oc
JOIN pm.projects p
  ON oc.project_id ~ '^[0-9]+$' AND p.legacy_id = oc.project_id::int
ON CONFLICT (legacy_contract_id) DO NOTHING;

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
-- SELECT
--   (SELECT count(*) FROM public.odg_contract)                    AS legacy,
--   (SELECT count(*) FROM pm.contracts WHERE legacy_contract_id IS NOT NULL) AS pm_app_contracts,
--   (SELECT count(*) FROM pm.contracts WHERE quotation_id IS NULL) AS unlinked_quotations;
