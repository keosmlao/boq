import { cookies } from "next/headers";
import { verifySession } from "@/_lib/auth_session";
import { can, isManager, isAdmin, type Action, type Permissions } from "@/_lib/permissions";

export type SessionUser = {
  username: string;
  name: string;
  role: string;
  permissions: Permissions;
};

/** Read + verify the odg-auth session cookie. Returns null when not logged in. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get("odg-auth")?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  return {
    username: String(payload.username ?? ""),
    name: String(payload.name_1 ?? payload.name ?? payload.username ?? ""),
    role: String(payload.role ?? "staff"),
    permissions: (payload.perms && typeof payload.perms === "object" ? payload.perms : {}) as Permissions,
  };
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Throw unless logged in. Returns the session user. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AuthError("ກະລຸນາເຂົ້າສູ່ລະບົບ");
  return u;
}

/** Throw unless the user is a manager or admin (user-management tier). */
export async function requireManager(): Promise<SessionUser> {
  const u = await requireUser();
  if (!isManager(u)) throw new AuthError("ບໍ່ມີສິດເຂົ້າເຖິງ (ສະເພາະຜູ້ຈັດການ)");
  return u;
}

/** Throw unless the user is an admin (ຜູ້ດູແລລະບົບ) — role/permission management tier. */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (!isAdmin(u)) throw new AuthError("ບໍ່ມີສິດເຂົ້າເຖິງ (ສະເພາະຜູ້ດູແລລະບົບ)");
  return u;
}

/** Throw unless the user may perform `action` on `moduleKey`. */
export async function requirePermission(moduleKey: string, action: Action = "view"): Promise<SessionUser> {
  const u = await requireUser();
  if (!can(u, moduleKey, action)) throw new AuthError("ບໍ່ມີສິດດຳເນີນການນີ້");
  return u;
}
