-- Move 6 project-manager tables from public.* into the pm.* schema.
--
-- These were grouped under "ERP" (app/_db/erp) but are owned by THIS app, not
-- the external ERP. ERP no longer reads/writes them (confirmed), so we move them
-- into the app-owned `pm` schema and remove them from `public`.
--
-- SET SCHEMA preserves ALL data, indexes, constraints and the primary key — it
-- is NOT a drop/recreate, so nothing is lost. Table names are kept as-is.
--
-- After applying this, the app references them as `pm.odg_*` (already updated in
-- the application code). Apply deliberately during the cut-over window.
--
-- Reversible: ALTER TABLE pm.odg_* SET SCHEMA public;

-- pm may not exist yet on this DB (rebuild 0000 not applied here) — create it.
CREATE SCHEMA IF NOT EXISTS pm;

ALTER TABLE IF EXISTS public.odg_project_manager_user   SET SCHEMA pm;
ALTER TABLE IF EXISTS public.odg_project_type           SET SCHEMA pm;
ALTER TABLE IF EXISTS public.odg_project_business_type  SET SCHEMA pm;
ALTER TABLE IF EXISTS public.odg_project_business_model SET SCHEMA pm;
ALTER TABLE IF EXISTS public.odg_task_master            SET SCHEMA pm;
ALTER TABLE IF EXISTS public.odg_withdraw_info          SET SCHEMA pm;
