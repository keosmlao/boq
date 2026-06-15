-- Odoo-style scheduled Activities (to-dos) on records (app-owned, public schema).
-- Additive only; the app also creates this lazily via CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.odg_record_activities (
  id                  bigserial   PRIMARY KEY,
  entity_type         text        NOT NULL,                 -- project | contract | quotation | boq | request | work_order
  entity_id           text        NOT NULL,
  activity_type       text        NOT NULL DEFAULT 'todo',  -- todo | call | meeting | email | document
  summary             text,
  note                text,
  assignee_username   text,
  assignee_name       text,
  due_date            date,
  state               text        NOT NULL DEFAULT 'planned', -- planned | done | cancelled
  created_by_username text,
  created_by_name     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  done_at             timestamptz,
  done_by_username    text,
  done_by_name        text
);
CREATE INDEX IF NOT EXISTS idx_odg_activities_record
  ON public.odg_record_activities (entity_type, entity_id, state);
CREATE INDEX IF NOT EXISTS idx_odg_activities_assignee
  ON public.odg_record_activities (assignee_username, state, due_date);
COMMENT ON TABLE public.odg_record_activities IS 'ODG Project Management (BOQ2026 v2) — scheduled activities / to-dos. App-owned; do not modify from ERP.';
