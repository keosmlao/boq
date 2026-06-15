"use server";

/**
 * Global live chat — one shared room for every signed-in user. Backed by
 * public.odg_chat_messages and polled from the client. Kept deliberately
 * simple: send + fetch-since for incremental polling.
 */
import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";
import { getSessionUser } from "@/_lib/server-auth";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; message: string };
function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function fail(message: string): Fail { return { success: false, message }; }

export type ChatMessage = {
  id: string;
  username: string | null;
  user_name: string | null;
  body: string;
  created_at: string;
};

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
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
      // Mark ownership in the shared DB.
      await query(`COMMENT ON TABLE public.odg_chat_messages IS 'ODG Project Management (BOQ2026 v2) — global live chat. App-owned; do not modify from ERP.'`);
    })().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}

/**
 * Fetch messages. With `sinceId`, returns only newer ones (ascending) for
 * incremental polling. Without it, returns the most recent `limit` (ascending).
 */
export async function getChatMessages(sinceId?: string | number, limit = 80): Promise<Ok<ChatMessage[]> | Fail> {
  try {
    await ensureTable();
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
  } catch (e) { return fail((e as Error).message); }
}

/** Post a message to the global room as the signed-in user. */
export async function sendChatMessage(body: string): Promise<Ok<ChatMessage> | Fail> {
  try {
    await ensureTable();
    const user = await getSessionUser();
    if (!user) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    const text = cleanText(body);
    if (!text) return fail("empty");
    if (text.length > 2000) return fail("ຂໍ້ຄວາມຍາວເກີນໄປ");
    const r = await query(
      `INSERT INTO public.odg_chat_messages (username, user_name, body)
       VALUES ($1, $2, $3)
       RETURNING id::text, username, user_name, body, created_at`,
      [user.username, user.name, text],
    );
    return ok(r.rows[0] as ChatMessage);
  } catch (e) { return fail((e as Error).message); }
}
