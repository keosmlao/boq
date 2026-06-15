-- ============================================================================
-- Phase 1 backfill — public.odg_projects  →  pm.projects   (RUN FIRST)
-- ============================================================================
-- DELIBERATE, MANUALLY-APPLIED. Staging first, verify, then production.
--
-- projects is the ROOT: every other backfill (0001-0006) remaps its foreign
-- keys through pm.projects.legacy_id, so this MUST run before them (and the
-- others should be re-run after this to pick up their project links).
--
-- Columns mapped from the app's own INSERT (app/_lib/projects.ts):
--   project_name, project_description, province/district/village (ERP codes),
--   coordinator, phone, image_url, sale_code, sml_code, office_lg/project_lg
--   ("lat,lng" strings), project_type, project_status (Lao), date_register,
--   business_type_id, business_model_id.
--
-- Idempotent via legacy_id (= odg_projects.id).
--
-- ⚠️ STATUS MAP — CONFIRM: pm.project_status only models the lifecycle labels
-- below. The legacy project_status also holds v2 *pipeline-stage* labels
-- (ສະເໜີລາຄາ / ສັນຍາ / BOQ / ກຳນົດໜ້າວຽກ / ໃບງານ / ສຳຫຼວດ / ລົງທະບຽນ); those have
-- no 1:1 enum and currently fall through to 'in_progress'. Tell me the intended
-- mapping and I'll refine the CASE.
-- ============================================================================

BEGIN;

INSERT INTO pm.projects (
  legacy_id, name, description, sml_code,
  province_code, district_code, village_code,
  coordinator, phone, image_url, sale_code,
  project_type_code, business_type_code, business_model_code,
  office_lat, office_lng, project_lat, project_lng,
  status, registered_on, created_at, updated_at
)
SELECT
  o.id,
  COALESCE(NULLIF(o.project_name, ''), '(ບໍ່ມີຊື່)'),
  o.project_description,
  o.sml_code,
  o.province, o.district, o.village,
  o.coordinator, o.phone, o.image_url, o.sale_code,
  o.project_type, o.business_type_id, o.business_model_id,
  CASE WHEN o.office_lg  ~ '^ *-?[0-9.]+ *, *-?[0-9.]+ *$' THEN NULLIF(trim(split_part(o.office_lg,  ',', 1)), '')::double precision END,
  CASE WHEN o.office_lg  ~ '^ *-?[0-9.]+ *, *-?[0-9.]+ *$' THEN NULLIF(trim(split_part(o.office_lg,  ',', 2)), '')::double precision END,
  CASE WHEN o.project_lg ~ '^ *-?[0-9.]+ *, *-?[0-9.]+ *$' THEN NULLIF(trim(split_part(o.project_lg, ',', 1)), '')::double precision END,
  CASE WHEN o.project_lg ~ '^ *-?[0-9.]+ *, *-?[0-9.]+ *$' THEN NULLIF(trim(split_part(o.project_lg, ',', 2)), '')::double precision END,
  (CASE o.project_status
     WHEN 'ລໍຖ້າດຳເນີນ'              THEN 'pending'
     WHEN 'ຂັ້ນຕອນດຳເນີນໂຄງການ'      THEN 'in_progress'
     WHEN 'ສາມາດເບີກຂອງໃດ້'          THEN 'ready_to_withdraw'
     WHEN 'ດຳເນີນການຕິດຕັ້ງ'         THEN 'installing'
     WHEN 'ລໍຖ້າອະນຸມັດປິດໂຄງການ'     THEN 'pending_close'
     WHEN 'ປິດໂຄງການ'               THEN 'closed'
     WHEN 'ຍົກເລີກ'                 THEN 'cancelled'
     ELSE 'in_progress'   -- v2 pipeline-stage labels — CONFIRM mapping
   END)::pm.project_status,
  o.date_register,
  COALESCE(o.created_at, now()),
  COALESCE(o.created_at, now())
FROM public.odg_projects o
ON CONFLICT (legacy_id) DO NOTHING;

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
-- SELECT
--   (SELECT count(*) FROM public.odg_projects) AS legacy,
--   (SELECT count(*) FROM pm.projects)         AS pm_projects,
--   (SELECT count(*) FROM pm.projects WHERE office_lat IS NOT NULL) AS with_office_geo;
