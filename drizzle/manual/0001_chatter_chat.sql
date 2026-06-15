-- Chatter / activity feed + global live chat (app-owned, public schema).
-- Additive only. The app also creates these lazily via CREATE TABLE IF NOT EXISTS,
-- but apply this deliberately to keep the migration record explicit.

CREATE TABLE IF NOT EXISTS public.odg_activities (
  id           bigserial PRIMARY KEY,
  entity_type  text        NOT NULL,                 -- project | contract | quotation | boq | request | work_order
  entity_id    text        NOT NULL,
  kind         text        NOT NULL DEFAULT 'comment', -- 'comment' (user post) | 'activity' (system event)
  action       text,                                  -- created | updated | approved | deleted | status ...
  body         text,
  username     text,
  user_name    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_odg_activities_entity
  ON public.odg_activities (entity_type, entity_id, id);
COMMENT ON TABLE public.odg_activities IS 'ODG Project Management (BOQ2026 v2) — chatter & activity feed. App-owned; do not modify from ERP.';

CREATE TABLE IF NOT EXISTS public.odg_chat_messages (
  id          bigserial   PRIMARY KEY,
  username    text,
  user_name   text,
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_odg_chat_created
  ON public.odg_chat_messages (id);
COMMENT ON TABLE public.odg_chat_messages IS 'ODG Project Management (BOQ2026 v2) — global live chat. App-owned; do not modify from ERP.';
