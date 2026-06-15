"use server";

import { cookies } from "next/headers";
import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";
import { getSalesStats } from "@/_lib/projects";
import bcrypt from "bcryptjs";
import { signSession } from "@/_lib/auth_session";
import { ensureUsersSchema } from "@/_lib/schemas/users";
import { normalizePermissions, type Permissions } from "@/_lib/permissions";

type Fail = { success: false; message: string };
function fail(message: string): Fail { return { success: false, message }; }

const DB_CONNECTION_CODES = new Set([
  "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH",
  "ENETUNREACH", "EAI_AGAIN", "EPIPE", "ECONNRESET",
  "57P03", "08000", "08001", "08003", "08004", "08006", "08007", "08P01",
]);

function isDbConnectionError(e: any): boolean {
  if (!e) return false;
  const code = e?.code || e?.errno;
  if (code && DB_CONNECTION_CODES.has(String(code))) return true;
  const msg = String(e?.message || "").toLowerCase();
  return msg.includes("connect") || msg.includes("timeout") ||
    msg.includes("econn") || msg.includes("etimedout") ||
    msg.includes("terminating connection") || msg.includes("server closed");
}

export async function login(input: { username: string; password: string }): Promise<
  { success: true; username: string; role: string; name_1: string; permissions: Permissions } | Fail
> {
  try {
    const username = cleanText(input?.username);
    const password = cleanText(input?.password);

    if (!username || !password) return fail("ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ");

    await ensureUsersSchema();

    // RBAC config row (role/permissions/active) — the source of truth when present.
    const cfgRes = await query(
      `SELECT username, name, password_hash, role, active, permissions FROM odg_app_user WHERE username = $1 LIMIT 1`,
      [username],
    );
    const cfg = cfgRes.rows[0] as
      | { username: string; name: string | null; password_hash: string | null; role: string; active: boolean; permissions: unknown }
      | undefined;
    if (cfg && cfg.active === false) return fail("ບັນຊີນີ້ຖືກປິດການນຳໃຊ້");

    let authed = false;
    let displayName = cfg?.name || null;

    // 1) Authenticate against the v2 password hash if this user has one.
    if (cfg?.password_hash) {
      authed = bcrypt.compareSync(password, cfg.password_hash);
    }

    // 2) Otherwise fall back to the ERP-provisioned credential store.
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
          // Upgrade the ERP cleartext password to bcrypt on this login.
          try {
            await query(`UPDATE odg_project_manager_user SET password = $1 WHERE username = $2`, [bcrypt.hashSync(password, 10), erp.username]);
          } catch (e) {
            console.error("Password rehash-on-login failed:", e);
          }
        }
      }
    }

    if (!authed) {
      if (!cfg && !erp) return fail("ບໍ່ພົບຊື່ຜູ້ໃຊ້ນີ້");
      return fail("ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ");
    }

    // Effective role + permissions: the v2 config row wins; ERP-only users that
    // are not yet configured default to admin (preserves prior full access).
    const role = cfg ? String(cfg.role || "staff") : "admin";
    const permissions = cfg ? normalizePermissions(cfg.permissions) : {};
    const name = displayName || username;

    const token = await signSession({ username, role, name_1: name, perms: permissions });

    const cookieStore = await cookies();
    cookieStore.set("odg-auth", token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    return { success: true, username, role, name_1: name, permissions };
  } catch (e) {
    console.error("Login DB error:", e);
    if (isDbConnectionError(e)) {
      return fail("ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນ ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ");
    }
    return fail((e as Error).message || "ເຂົ້າລະບົບບໍ່ສຳເລັດ");
  }
}

export async function getSalesStatsAction(): Promise<{ success: true } & Record<string, unknown> | Fail> {
  try {
    const stats = await getSalesStats() as Record<string, unknown>;
    return { success: true, ...stats };
  } catch (e) { return fail((e as Error).message); }
}

export async function logout(): Promise<{ success: true }> {
  try {
    const cookieStore = await cookies();
    cookieStore.set("odg-auth", "", {
      path: "/",
      maxAge: 0,
    });
    return { success: true };
  } catch (e) {
    return { success: true };
  }
}
