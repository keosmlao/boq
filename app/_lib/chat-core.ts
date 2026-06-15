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
