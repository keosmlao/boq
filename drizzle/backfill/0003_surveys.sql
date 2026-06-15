-- ============================================================================
-- Phase 1 backfill — public.odg_survey  →  pm.surveys
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Staging first, verify, then production.
--
-- PREREQUISITE: backfill pm.projects FIRST. pm.surveys.project_id is NOT NULL,
-- so this INNER-JOINs pm.projects on legacy_id; surveys whose project isn't
-- migrated yet are skipped — re-run after projects to pick them up.
--
-- IDEMPOTENCY: pm.surveys has no legacy_id column, so we can't ON CONFLICT.
-- We dedupe on (project_id, completed_date, surveyor). RECOMMENDED: add a
-- `legacy_id integer unique` column to pm.surveys for a robust key (then switch
-- this to ON CONFLICT, like 0001/0002).
--
-- MAPPING: legacy single `survey_date` -> completed_date (legacy default status
-- is 'done'); scheduled_date left NULL. status text -> pm.survey_status enum.
-- ============================================================================

BEGIN;

INSERT INTO pm.surveys (
  project_id, status, surveyor, scheduled_date, completed_date, findings, data, created_at, updated_at
)
SELECT
  p.id,
  (CASE lower(os.status)
     WHEN 'scheduled' THEN 'scheduled'
     WHEN 'pending'   THEN 'pending'
     WHEN 'cancelled' THEN 'cancelled'
     ELSE 'done'
   END)::pm.survey_status,
  os.surveyor,
  NULL::date,
  os.survey_date,
  os.findings,
  COALESCE(os.data, '{}'::jsonb),
  COALESCE(os.created_at, now()),
  COALESCE(os.updated_at, now())
FROM public.odg_survey os
JOIN pm.projects p
  ON os.project_id ~ '^[0-9]+$' AND p.legacy_id = os.project_id::int
WHERE NOT EXISTS (
  SELECT 1 FROM pm.surveys s2
  WHERE s2.project_id = p.id
    AND s2.completed_date IS NOT DISTINCT FROM os.survey_date
    AND s2.surveyor       IS NOT DISTINCT FROM os.surveyor
);

COMMIT;

-- ── Verification (legacy may exceed pm if some projects aren't migrated yet) ─
-- SELECT
--   (SELECT count(*) FROM public.odg_survey) AS legacy,
--   (SELECT count(*) FROM pm.surveys)        AS pm_surveys;
