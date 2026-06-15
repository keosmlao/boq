"use server";

/**
 * Global live chat — one shared room for every signed-in user. Backed by
 * public.odg_chat_messages and polled from the client. The actual queries live
 * in @/_lib/chat-core so the mobile REST API can reuse them; these thin server
 * actions add the cookie-session identity.
 */
import { getSessionUser } from "@/_lib/server-auth";
import { getChatMessagesCore, sendChatMessageAs, type ChatMessage } from "@/_lib/chat-core";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; message: string };

export async function getChatMessages(sinceId?: string | number, limit = 80): Promise<Ok<ChatMessage[]> | Fail> {
  return getChatMessagesCore(sinceId, limit);
}

/** Post a message to the global room as the signed-in user. */
export async function sendChatMessage(body: string): Promise<Ok<ChatMessage> | Fail> {
  const user = await getSessionUser();
  return sendChatMessageAs(user, body);
}
