"use server";

/**
 * Followers on document records (Odoo-style). Users who follow a record are the
 * audience for its chatter/activities. Commenting or being assigned an activity
 * auto-subscribes you (see ensureFollower, called from chatter/activities).
 * Stored in the app-owned public.odg_record_followers table.
 */
import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";
import { getSessionUser } from "@/_lib/server-auth";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; message: string };
function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function fail(message: string): Fail { return { success: false, message }; }

const ENTITY_TYPES = ["project", "contract", "quotation", "boq", "request", "work_order"] as const;
function normType(t: unknown): string | null {
  const v = cleanText(t);
  return (ENTITY_TYPES as readonly string[]).includes(v) ? v : null;
}

export type Follower = { username: string; name: string | null; added_at: string };

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS public.odg_record_followers (
          id          bigserial PRIMARY KEY,
          entity_type text NOT NULL,
          entity_id   text NOT NULL,
          username    text NOT NULL,
          name        text,
          added_at    timestamptz NOT NULL DEFAULT now()
        )
      `);
      await query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_odg_followers ON public.odg_record_followers (entity_type, entity_id, username)`);
      await query(`COMMENT ON TABLE public.odg_record_followers IS 'ODG Project Management (BOQ2026 v2) — record followers. App-owned; do not modify from ERP.'`);
    })().catch((e) => { ensured = null; throw e; });
  }
  return ensured;
}

/** Best-effort subscribe (used by comment/activity actions). Never throws. */
export async function ensureFollower(entityType: string, entityId: string, username: string, name?: string): Promise<void> {
  try {
    await ensureTable();
    const type = normType(entityType);
    const id = cleanText(entityId);
    const u = cleanText(username);
    if (!type || !id || !u) return;
    await query(
      `INSERT INTO public.odg_record_followers (entity_type, entity_id, username, name)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (entity_type, entity_id, username) DO NOTHING`,
      [type, id, u, cleanText(name) || u],
    );
  } catch {
    /* following is non-critical */
  }
}

/** Followers of a record + whether the current user is one. */
export async function getFollowers(entityType: string, entityId: string): Promise<Ok<{ followers: Follower[]; following: boolean }> | Fail> {
  try {
    await ensureTable();
    const me = await getSessionUser();
    const type = normType(entityType);
    const id = cleanText(entityId);
    if (!type || !id) return ok({ followers: [], following: false });
    const r = await query(
      `SELECT username, name, added_at FROM public.odg_record_followers
        WHERE entity_type = $1 AND entity_id = $2 ORDER BY added_at ASC`,
      [type, id],
    );
    const followers = r.rows as Follower[];
    return ok({ followers, following: !!me && followers.some((f) => f.username === me.username) });
  } catch (e) { return fail((e as Error).message); }
}

/** Current user follows the record. */
export async function followRecord(entityType: string, entityId: string): Promise<Ok<true> | Fail> {
  try {
    const me = await getSessionUser();
    if (!me) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    await ensureFollower(entityType, entityId, me.username, me.name);
    return ok(true);
  } catch (e) { return fail((e as Error).message); }
}

/** Add another user as a follower. */
export async function addFollower(entityType: string, entityId: string, username: string, name?: string): Promise<Ok<true> | Fail> {
  try {
    const me = await getSessionUser();
    if (!me) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    if (!cleanText(username)) return fail("username required");
    await ensureFollower(entityType, entityId, username, name);
    return ok(true);
  } catch (e) { return fail((e as Error).message); }
}

/** Remove a follower (defaults to the current user). */
export async function unfollowRecord(entityType: string, entityId: string, username?: string): Promise<Ok<true> | Fail> {
  try {
    await ensureTable();
    const me = await getSessionUser();
    if (!me) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    const type = normType(entityType);
    const id = cleanText(entityId);
    const target = cleanText(username) || me.username;
    if (!type || !id) return fail("entity invalid");
    await query(
      `DELETE FROM public.odg_record_followers WHERE entity_type = $1 AND entity_id = $2 AND username = $3`,
      [type, id, target],
    );
    return ok(true);
  } catch (e) { return fail((e as Error).message); }
}
