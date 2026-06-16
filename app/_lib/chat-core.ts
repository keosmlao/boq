/**
 * Global live-chat core — one shared room for every signed-in user, backed by
 * public.odg_chat_messages. Shared by the web server actions (cookie session)
 * and the mobile REST API (Bearer token); authn happens in the callers.
 */
import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; message: string };
const ok = <T>(data: T): Ok<T> => ({ success: true, data });
const fail = (message: string): Fail => ({ success: false, message });

export type ChatMessage = {
  id: string;
  username: string | null;
  user_name: string | null;
  body: string;
  created_at: string;
};

let ensured: Promise<void> | null = null;
export function ensureChatTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS public.odg_chat_messages (
          id          bigserial PRIMARY KEY,
          username    text,
          user_name   text,
          body        text NOT NULL,
          created_at  timestamptz NOT NULL DEFAULT now()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_odg_chat_created ON public.odg_chat_messages (id)`);
      await query(`COMMENT ON TABLE public.odg_chat_messages IS 'ODG Project Management (BOQ2026 v2) — global live chat. App-owned; do not modify from ERP.'`);
    })().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}

/** Fetch messages; with `sinceId` returns only newer ones (ascending) for polling. */
export async function getChatMessagesCore(sinceId?: string | number, limit = 80): Promise<Ok<ChatMessage[]> | Fail> {
  try {
    await ensureChatTable();
    const cap = Math.min(Math.max(Number(limit) || 80, 1), 200);
    const since = Number(sinceId);
    if (Number.isFinite(since) && since > 0) {
      const r = await query(
        `SELECT id::text, username, user_name, body, created_at
           FROM public.odg_chat_messages
          WHERE id > $1
          ORDER BY id ASC
          LIMIT $2`,
        [since, cap],
      );
      return ok(r.rows as ChatMessage[]);
    }
    const r = await query(
      `SELECT id::text, username, user_name, body, created_at FROM (
         SELECT id, username, user_name, body, created_at
           FROM public.odg_chat_messages
          ORDER BY id DESC
          LIMIT $1
       ) t ORDER BY id ASC`,
      [cap],
    );
    return ok(r.rows as ChatMessage[]);
  } catch (e) {
    return fail((e as Error).message);
  }
}

/* ── Read receipts ───────────────────────────────────────────────────────────
 * One shared room, so "read" = some OTHER participant has read up to a message.
 * We store each user's high-water mark (the newest message id they've seen) in
 * odg_chat_read; a sender's message is "read" when anyone else's mark >= its id.
 */
let ensuredRead: Promise<void> | null = null;
function ensureChatReadTable(): Promise<void> {
  if (!ensuredRead) {
    ensuredRead = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS public.odg_chat_read (
          username     text PRIMARY KEY,
          last_read_id bigint NOT NULL DEFAULT 0,
          updated_at   timestamptz NOT NULL DEFAULT now()
        )
      `);
    })().catch((e) => {
      ensuredRead = null;
      throw e;
    });
  }
  return ensuredRead;
}

/**
 * Mark the user as having read up to `lastId` (or the newest message when
 * omitted). Never moves the mark backwards.
 */
export async function markChatReadAs(user: { username: string } | null, lastId?: string | number): Promise<Ok<{ last_read_id: string }> | Fail> {
  try {
    if (!user?.username) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    await ensureChatTable();
    await ensureChatReadTable();
    let target = Number(lastId);
    if (!Number.isFinite(target) || target <= 0) {
      const m = await query(`SELECT COALESCE(MAX(id), 0)::bigint AS max_id FROM public.odg_chat_messages`);
      target = Number(m.rows[0]?.max_id ?? 0);
    }
    const r = await query(
      `INSERT INTO public.odg_chat_read (username, last_read_id, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (username) DO UPDATE
         SET last_read_id = GREATEST(public.odg_chat_read.last_read_id, EXCLUDED.last_read_id),
             updated_at = now()
       RETURNING last_read_id::text`,
      [user.username, target],
    );
    return ok({ last_read_id: String(r.rows[0]?.last_read_id ?? target) });
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * The newest message id that has been read by someone OTHER than `excludeUsername`.
 * The viewer's own messages with id <= this are shown as "read".
 */
export async function getReadWatermark(excludeUsername?: string | null): Promise<string> {
  try {
    await ensureChatReadTable();
    const r = await query(
      `SELECT COALESCE(MAX(last_read_id), 0)::text AS wm
         FROM public.odg_chat_read
        WHERE username IS DISTINCT FROM $1`,
      [excludeUsername || null],
    );
    return String(r.rows[0]?.wm ?? "0");
  } catch {
    return "0";
  }
}

/** Post a message as the given user. */
export async function sendChatMessageAs(user: { username: string; name?: string } | null, body: string): Promise<Ok<ChatMessage> | Fail> {
  try {
    await ensureChatTable();
    if (!user?.username) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    const text = cleanText(body);
    if (!text) return fail("empty");
    if (text.length > 2000) return fail("ຂໍ້ຄວາມຍາວເກີນໄປ");
    const r = await query(
      `INSERT INTO public.odg_chat_messages (username, user_name, body)
       VALUES ($1, $2, $3)
       RETURNING id::text, username, user_name, body, created_at`,
      [user.username, user.name || user.username, text],
    );
    return ok(r.rows[0] as ChatMessage);
  } catch (e) {
    return fail((e as Error).message);
  }
}
