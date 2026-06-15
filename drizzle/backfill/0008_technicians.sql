-- ============================================================================
-- Phase 1 backfill — public.odg_technicians  →  pm.technicians
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Staging first, verify, then production.
-- Run before 0009 (work orders link to technicians by code).
-- Idempotent: dedupe on code (pm.technicians has no legacy_id).
-- ============================================================================

BEGIN;

INSERT INTO pm.technicians (code, name, role, created_at)
SELECT
  t.code,
  COALESCE(NULLIF(t.name_1, ''), t.code),
  'technician'::pm.technician_role,
  now()
FROM public.odg_technicians t
WHERE t.code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pm.technicians tt WHERE tt.code = t.code);

COMMIT;

-- SELECT (SELECT count(*) FROM public.odg_technicians) AS legacy,
--        (SELECT count(*) FROM pm.technicians)         AS pm_technicians;
