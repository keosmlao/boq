-- In-app notifications (app-owned, public schema).
-- Additive only; the app also creates this lazily via CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.odg_notifications (
  id                 bigserial   PRIMARY KEY,
  recipient_username text        NOT NULL,
  entity_type        text        NOT NULL,
  entity_id          text        NOT NULL,
  kind               text        NOT NULL DEFAULT 'comment', -- comment | activity | activity_done
  actor_username     text,
  actor_name         text,
  body               text,
  is_read            boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_odg_notifications_recipient
  ON public.odg_notifications (recipient_username, is_read, id DESC);
COMMENT ON TABLE public.odg_notifications IS 'ODG Project Management (BOQ2026 v2) — in-app notifications. App-owned; do not modify from ERP.';
