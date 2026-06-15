/**
 * Credential check shared by the web login (cookie session) and the mobile
 * REST login (Bearer token). Does the DB + bcrypt work and returns the
 * effective role/permissions; signing/cookie-setting stays in the callers.
 */
import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";
import bcrypt from "bcryptjs";
import { ensureUsersSchema } from "@/_lib/schemas/users";
import { normalizePermissions, type Permissions } from "@/_lib/permissions";

export type AuthedUser = {
  username: string;
  role: string;
  name: string;
  permissions: Permissions;
};

export type AuthResult = { ok: true; user: AuthedUser } | { ok: false; message: string };

const DB_CONNECTION_CODES = new Set([
  "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH",
  "ENETUNREACH", "EAI_AGAIN", "EPIPE", "ECONNRESET",
  "57P03", "08000", "08001", "08003", "08004", "08006", "08007", "08P01",
]);

export function isDbConnectionError(e: any): boolean {
  if (!e) return false;
  const code = e?.code || e?.errno;
  if (code && DB_CONNECTION_CODES.has(String(code))) return true;
  const msg = String(e?.message || "").toLowerCase();
  return msg.includes("connect") || msg.includes("timeout") ||
    msg.includes("econn") || msg.includes("etimedout") ||
    msg.includes("terminating connection") || msg.includes("server closed");
}

/** Verify a username/password against the v2 (odg_app_user) + ERP credential stores. */
export async function authenticateUser(usernameRaw: unknown, passwordRaw: unknown): Promise<AuthResult> {
  const username = cleanText(usernameRaw);
  const password = cleanText(passwordRaw);
  if (!username || !password) return { ok: false, message: "ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ" };

  await ensureUsersSchema();

  const cfgRes = await query(
    `SELECT username, name, password_hash, role, active, permissions FROM odg_app_user WHERE username = $1 LIMIT 1`,
    [username],
  );
  const cfg = cfgRes.rows[0] as
    | { username: string; name: string | null; password_hash: string | null; role: string; active: boolean; permissions: unknown }
    | undefined;
  if (cfg && cfg.active === false) return { ok: false, message: "ບັນຊີນີ້ຖືກປິດການນຳໃຊ້" };

  let authed = false;
  let displayName = cfg?.name || null;

  if (cfg?.password_hash) {
    authed = bcrypt.compareSync(password, cfg.password_hash);
  }

  const erpRes = await query(
    `SELECT username, password, name_1 FROM odg_project_manager_user WHERE username = $1 LIMIT 1`,
    [username],
  );
  const erp = erpRes.rows[0] as { username: string; password: string | null; name_1: string | null } | undefined;
  if (!authed && erp) {
    const dbPassword = cleanText(erp.password);
    const isHashed = dbPassword.startsWith("$2a$") || dbPassword.startsWith("$2b$");
    authed = isHashed ? bcrypt.compareSync(password, dbPassword) : dbPassword === password;
    if (authed) {
      displayName = displayName || erp.name_1;
      if (!isHashed) {
        try {
          await query(`UPDATE odg_project_manager_user SET password = $1 WHERE username = $2`, [bcrypt.hashSync(password, 10), erp.username]);
        } catch (e) {
          console.error("Password rehash-on-login failed:", e);
        }
      }
    }
  }

  if (!authed) {
    if (!cfg && !erp) return { ok: false, message: "ບໍ່ພົບຊື່ຜູ້ໃຊ້ນີ້" };
    return { ok: false, message: "ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" };
  }

  const role = cfg ? String(cfg.role || "staff") : "admin";
  const permissions = cfg ? normalizePermissions(cfg.permissions) : {};
  const name = displayName || username;
  return { ok: true, user: { username, role, name, permissions } };
}
