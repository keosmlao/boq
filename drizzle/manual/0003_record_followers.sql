-- Record followers (Odoo-style, app-owned, public schema).
-- Additive only; the app also creates this lazily via CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.odg_record_followers (
  id          bigserial   PRIMARY KEY,
  entity_type text        NOT NULL,                 -- project | contract | quotation | boq | request | work_order
  entity_id   text        NOT NULL,
  username    text        NOT NULL,
  name        text,
  added_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_odg_followers
  ON public.odg_record_followers (entity_type, entity_id, username);
COMMENT ON TABLE public.odg_record_followers IS 'ODG Project Management (BOQ2026 v2) — record followers. App-owned; do not modify from ERP.';
