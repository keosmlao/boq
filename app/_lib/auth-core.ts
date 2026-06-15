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

  // 3) ERP employee store — craftsmen / staff log in with their employee_code.
  //    (odg_employee.employee_code === odg_technicians.code === work order technician_code)
  let emp:
    | { employee_code: string; fullname_lo: string | null; password: string | null; app_role: string | null; pos_pin_hash: string | null }
    | undefined;
  if (!authed) {
    try {
      const empRes = await query(
        `SELECT employee_code, fullname_lo, password, app_role, pos_pin_hash FROM odg_employee WHERE employee_code = $1 LIMIT 1`,
        [username],
      );
      emp = empRes.rows[0] as typeof emp;
    } catch {
      /* odg_employee not reachable */
    }
    if (emp) {
      const pw = cleanText(emp.password);
      if (pw) {
        const isHashed = pw.startsWith("$2a$") || pw.startsWith("$2b$");
        authed = isHashed ? bcrypt.compareSync(password, pw) : pw === password;
      }
      // Fallback: POS PIN (bcrypt-hashed) — lets a craftsman sign in with their PIN.
      if (!authed && emp.pos_pin_hash) {
        try {
          authed = bcrypt.compareSync(password, String(emp.pos_pin_hash));
        } catch {
          /* not a bcrypt hash */
        }
      }
      if (authed) displayName = displayName || emp.fullname_lo;
    }
  }

  if (!authed) {
    if (!cfg && !erp && !emp) return { ok: false, message: "ບໍ່ພົບຊື່ຜູ້ໃຊ້ນີ້" };
    return { ok: false, message: "ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" };
  }

  let role: string;
  let permissions: Permissions;
  if (cfg) {
    role = String(cfg.role || "staff");
    permissions = normalizePermissions(cfg.permissions);
  } else if (erp) {
    role = "admin"; // existing behaviour: ERP manager users get full access
    permissions = {};
  } else {
    // odg_employee user: role from app_role (default staff). Craftsmen are staff;
    // work-order action authz is by assignment (technician_code), not the matrix.
    const ar = String(emp?.app_role || "staff").trim().toLowerCase();
    role = ar === "admin" || ar === "manager" || ar === "staff" ? ar : "staff";
    permissions = {};
  }
  const name = displayName || username;
  return { ok: true, user: { username, role, name, permissions } };
}
