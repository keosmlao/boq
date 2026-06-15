"use server";

/**
 * Chatter + activity feed for document records (projects, contracts, quotations,
 * BOQ, requests, work orders). One timeline per record mixing user comments
 * (kind='comment') and system activities (kind='activity'). Stored in the
 * app-owned public.odg_activities table.
 */
import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";
import { getSessionUser } from "@/_lib/server-auth";
import { isManager } from "@/_lib/permissions";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; message: string };
function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function fail(message: string): Fail { return { success: false, message }; }

const ENTITY_TYPES = ["project", "contract", "quotation", "boq", "request", "work_order"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

export type FeedItem = {
  id: string;
  entity_type: string;
  entity_id: string;
  kind: "comment" | "activity";
  action: string | null;
  body: string | null;
  username: string | null;
  user_name: string | null;
  created_at: string;
};

// Lazily create the table so the feature works before the manual migration is
// applied. Additive (IF NOT EXISTS); runs once per server process.
let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS public.odg_activities (
          id           bigserial PRIMARY KEY,
          entity_type  text NOT NULL,
          entity_id    text NOT NULL,
          kind         text NOT NULL DEFAULT 'comment',
          action       text,
          body         text,
          username     text,
          user_name    text,
          created_at   timestamptz NOT NULL DEFAULT now()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_odg_activities_entity ON public.odg_activities (entity_type, entity_id, id)`);
      // Mark ownership in the shared DB so it's clear this table belongs to the
      // ODG Project Management app (not ERP / other systems).
      await query(`COMMENT ON TABLE public.odg_activities IS 'ODG Project Management (BOQ2026 v2) — chatter & activity feed. App-owned; do not modify from ERP.'`);
    })().catch((e) => {
      ensured = null; // allow retry on a transient failure
      throw e;
    });
  }
  return ensured;
}

function normType(t: unknown): EntityType | null {
  const v = cleanText(t);
  return (ENTITY_TYPES as readonly string[]).includes(v) ? (v as EntityType) : null;
}

/** Timeline for one record, oldest → newest. */
export async function getFeed(entityType: string, entityId: string): Promise<Ok<FeedItem[]> | Fail> {
  try {
    await ensureTable();
    const type = normType(entityType);
    const id = cleanText(entityId);
    if (!type || !id) return ok([]);
    const result = await query(
      `SELECT id::text, entity_type, entity_id, kind, action, body, username, user_name, created_at
         FROM public.odg_activities
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY id ASC
        LIMIT 500`,
      [type, id],
    );
    return ok(result.rows as FeedItem[]);
  } catch (e) { return fail((e as Error).message); }
}

/** Post a comment to a record's timeline, attributed to the signed-in user. */
export async function addComment(entityType: string, entityId: string, body: string): Promise<Ok<FeedItem> | Fail> {
  try {
    await ensureTable();
    const user = await getSessionUser();
    if (!user) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    const type = normType(entityType);
    const id = cleanText(entityId);
    const text = cleanText(body);
    if (!type || !id) return fail("entity invalid");
    if (!text) return fail("ກະລຸນາໃສ່ຂໍ້ຄວາມ");
    const result = await query(
      `INSERT INTO public.odg_activities (entity_type, entity_id, kind, body, username, user_name)
       VALUES ($1, $2, 'comment', $3, $4, $5)
       RETURNING id::text, entity_type, entity_id, kind, action, body, username, user_name, created_at`,
      [type, id, text, user.username, user.name],
    );
    return ok(result.rows[0] as FeedItem);
  } catch (e) { return fail((e as Error).message); }
}

/** Record a system activity (called from other actions after a mutation). */
export async function logActivity(entityType: string, entityId: string, action: string, body?: string): Promise<void> {
  try {
    await ensureTable();
    const user = await getSessionUser();
    const type = normType(entityType);
    const id = cleanText(entityId);
    if (!type || !id) return;
    await query(
      `INSERT INTO public.odg_activities (entity_type, entity_id, kind, action, body, username, user_name)
       VALUES ($1, $2, 'activity', $3, $4, $5, $6)`,
      [type, id, cleanText(action), cleanText(body) || null, user?.username ?? null, user?.name ?? null],
    );
  } catch {
    // Activity logging must never break the underlying action.
  }
}

/** Delete a feed item — author or a manager only. */
export async function deleteFeedItem(id: string | number): Promise<Ok<true> | Fail> {
  try {
    await ensureTable();
    const user = await getSessionUser();
    if (!user) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    const rowId = Number(id);
    if (!Number.isFinite(rowId)) return fail("invalid id");
    if (isManager(user)) {
      await query(`DELETE FROM public.odg_activities WHERE id = $1`, [rowId]);
    } else {
      await query(`DELETE FROM public.odg_activities WHERE id = $1 AND username = $2`, [rowId, user.username]);
    }
    return ok(true);
  } catch (e) { return fail((e as Error).message); }
}
