/** Authenticate a mobile REST request from its `Authorization: Bearer <jwt>` header. */
import { verifySession } from "@/_lib/auth_session";
import type { ActingUser } from "@/_lib/workorder-core";

export async function bearerUser(req: Request): Promise<ActingUser | null> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = await verifySession(m[1].trim());
  if (!payload) return null;
  return {
    username: String(payload.username ?? ""),
    name: String(payload.name_1 ?? payload.name ?? payload.username ?? ""),
    role: String(payload.role ?? "staff"),
    permissions: (payload.perms && typeof payload.perms === "object" ? payload.perms : {}) as any,
  };
}
