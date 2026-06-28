"use server";

/**
 * In-app notifications. When something happens on a record (new comment, an
 * activity assigned/done), its followers get a notification row here. Surfaced
 * by the topbar bell. App-owned public.odg_notifications table.
 *
 * Reads the followers table directly (no import of followers.ts) to avoid an
 * import cycle, since chatter/activities import this module.
 */
import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";
import { notifyManagers as pushManagers } from "@/_lib/push";
import { getSessionUser } from "@/_lib/server-auth";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; message: string };
function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function fail(message: string): Fail { return { success: false, message }; }

export type Notification = {
  id: string;
  entity_type: string;
  entity_id: string;
  kind: string;
  actor_name: string | null;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS public.odg_notifications (
          id                 bigserial PRIMARY KEY,
          recipient_username text NOT NULL,
          entity_type        text NOT NULL,
          entity_id          text NOT NULL,
          kind               text NOT NULL DEFAULT 'comment',
          actor_username     text,
          actor_name         text,
          body               text,
          is_read            boolean NOT NULL DEFAULT false,
          created_at         timestamptz NOT NULL DEFAULT now()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_odg_notifications_recipient ON public.odg_notifications (recipient_username, is_read, id DESC)`);
      await query(`COMMENT ON TABLE public.odg_notifications IS 'ODG Project Management (BOQ2026 v2) — in-app notifications. App-owned; do not modify from ERP.'`);
    })().catch((e) => { ensured = null; throw e; });
  }
  return ensured;
}

/** Notify every follower of a record (except the actor). Best-effort. */
export async function notifyFollowers(
  entityType: string,
  entityId: string,
  kind: string,
  body: string,
  actorUsername: string,
): Promise<void> {
  try {
    await ensureTable();
    const type = cleanText(entityType);
    const id = cleanText(entityId);
    if (!type || !id) return;
    await query(
      `INSERT INTO public.odg_notifications (recipient_username, entity_type, entity_id, kind, actor_username, actor_name, body)
       SELECT f.username, $1, $2, $3, $4, $5, $6
         FROM public.odg_record_followers f
        WHERE f.entity_type = $1 AND f.entity_id = $2 AND f.username <> $4`,
      [type, id, cleanText(kind), cleanText(actorUsername), null, cleanText(body) || null],
    );
    // Fill actor_name from the most recent follower row if available (cheap, optional).
  } catch {
    /* notifications are non-critical */
  }
}

/** Notify one specific user (e.g. an activity assignee). Best-effort. */
export async function notifyUser(
  recipientUsername: string,
  entityType: string,
  entityId: string,
  kind: string,
  body: string,
  actorUsername: string,
  actorName?: string,
): Promise<void> {
  try {
    await ensureTable();
    const rcpt = cleanText(recipientUsername);
    const type = cleanText(entityType);
    const id = cleanText(entityId);
    if (!rcpt || !type || !id || rcpt === cleanText(actorUsername)) return;
    await query(
      `INSERT INTO public.odg_notifications (recipient_username, entity_type, entity_id, kind, actor_username, actor_name, body)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [rcpt, type, id, cleanText(kind), cleanText(actorUsername), cleanText(actorName) || null, cleanText(body) || null],
    );
  } catch {
    /* non-critical */
  }
}

/**
 * Notify the notification audience — every active admin/manager, plus anyone
 * explicitly granted the "notifications: receive" permission. Includes the
 * actor too, so the back office sees a complete movement log in their bell.
 */
export async function notifyManagers(
  entityType: string,
  entityId: string,
  kind: string,
  body: string,
  actorUsername: string,
  actorName?: string,
): Promise<void> {
  try {
    await ensureTable();
    const type = cleanText(entityType);
    const id = cleanText(entityId);
    if (!type || !id) return;
    const kindC = cleanText(kind);
    const actor = cleanText(actorUsername);
    const aname = cleanText(actorName) || null;
    const bodyC = cleanText(body) || null;
    const params = [type, id, kindC, actor, aname, bodyC];

    // 1) Managers/admins + anyone granted notifications.receive (excluding the
    //    actor — they're added in step 2). Wrapped separately so a jsonb/type
    //    quirk here can never block the actor's own notification below.
    try {
      await query(
        `INSERT INTO public.odg_notifications (recipient_username, entity_type, entity_id, kind, actor_username, actor_name, body)
         SELECT u.username, $1, $2, $3, $4, $5, $6
           FROM public.odg_app_user u
          WHERE COALESCE(u.active, true) = true
            AND u.username <> $4
            AND (
              lower(COALESCE(u.role, '')) IN ('admin', 'manager')
              OR COALESCE(u.permissions -> 'notifications', '[]'::jsonb) ? 'receive'
            )`,
        params,
      );
    } catch (e) {
      console.error("notifyManagers (audience):", (e as Error).message);
    }

    // 2) The actor always gets it too — so whoever performs the action sees the
    //    movement in their own bell (works even for ERP-only / non-app users).
    if (actor) {
      try {
        await query(
          `INSERT INTO public.odg_notifications (recipient_username, entity_type, entity_id, kind, actor_username, actor_name, body)
           VALUES ($4, $1, $2, $3, $4, $5, $6)`,
          params,
        );
      } catch (e) {
        console.error("notifyManagers (actor):", (e as Error).message);
      }
    }
  } catch {
    /* non-critical */
  }
}

/**
 * One-line document-event notifier for server actions — resolves the current
 * user and notifies the back office (in-app bell + push). Best-effort: never
 * throws, so it can't break the action it's called from.
 */
export async function notifyDocEvent(entityType: string, entityId: string, kind: string, body: string): Promise<void> {
  try {
    const u = await getSessionUser();
    await notifyManagers(entityType, entityId, kind, body, u?.username || "", u?.name);
    await pushManagers(body, body, { entity_type: cleanText(entityType), entity_id: cleanText(entityId) });
  } catch {
    /* non-critical */
  }
}

/** Recent notifications for the current user + unread count. */
export async function getMyNotifications(limit = 30): Promise<Ok<{ items: Notification[]; unread: number }> | Fail> {
  try {
    await ensureTable();
    const me = await getSessionUser();
    if (!me) return ok({ items: [], unread: 0 });
    const cap = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const [list, count] = await Promise.all([
      query(
        `SELECT id::text, entity_type, entity_id, kind, actor_name, body, is_read, created_at
           FROM public.odg_notifications
          WHERE recipient_username = $1
          ORDER BY id DESC
          LIMIT $2`,
        [me.username, cap],
      ),
      query(`SELECT count(*)::int AS n FROM public.odg_notifications WHERE recipient_username = $1 AND is_read = false`, [me.username]),
    ]);
    return ok({ items: list.rows as Notification[], unread: Number(count.rows[0]?.n || 0) });
  } catch (e) { return fail((e as Error).message); }
}

/** Mark some (or all) of the current user's notifications read. */
export async function markNotificationsRead(ids?: (string | number)[]): Promise<Ok<true> | Fail> {
  try {
    await ensureTable();
    const me = await getSessionUser();
    if (!me) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    if (ids && ids.length) {
      const nums = ids.map((x) => Number(x)).filter(Number.isFinite);
      if (nums.length) {
        await query(
          `UPDATE public.odg_notifications SET is_read = true WHERE recipient_username = $1 AND id = ANY($2::bigint[])`,
          [me.username, nums],
        );
      }
    } else {
      await query(`UPDATE public.odg_notifications SET is_read = true WHERE recipient_username = $1 AND is_read = false`, [me.username]);
    }
    return ok(true);
  } catch (e) { return fail((e as Error).message); }
}
