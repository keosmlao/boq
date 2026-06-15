"use server";

import bcrypt from "bcryptjs";
import { query } from "@/_lib/db";
import { ensureUsersSchema } from "@/_lib/schemas/users";
import { requireAdmin } from "@/_lib/server-auth";
import { normalizePermissions, type Role } from "@/_lib/permissions";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });
const clean = (v: unknown) => String(v ?? "").trim();
const VALID_ROLES: Role[] = ["admin", "manager", "head_craftsman", "staff"];
const asRole = (v: unknown): Role => (VALID_ROLES.includes(clean(v) as Role) ? (clean(v) as Role) : "staff");
/** Roles whose access is driven by the per-module permission matrix (admin/manager = full implicit). */
const usesPermissionMatrix = (role: Role) => role === "staff" || role === "head_craftsman";

export type AppUserRow = {
  username: string;
  name: string;
  role: string;
  active: boolean;
  permissions: Record<string, string[]>;
  source: "v2" | "erp";
};

/**
 * All login users the manager can configure: the v2-managed users
 * (odg_app_user) merged with ERP login users (odg_project_manager_user) that
 * don't yet have a v2 row. ERP-only users default to admin until configured.
 */
export async function getUsers(): Promise<{ success: true; data: AppUserRow[] } | Fail> {
  try {
    await requireAdmin();
    await ensureUsersSchema();

    const v2 = await query(`SELECT username, name, role, active, permissions FROM odg_app_user ORDER BY username`);
    const byName = new Map<string, AppUserRow>();
    for (const r of v2.rows as any[]) {
      byName.set(String(r.username), {
        username: String(r.username),
        name: r.name || r.username,
        role: r.role || "staff",
        active: r.active !== false,
        permissions: normalizePermissions(r.permissions),
        source: "v2",
      });
    }

    // ERP login users not yet configured in v2 (shown as admin-by-default).
    try {
      const erp = await query(`SELECT username, name_1 FROM odg_project_manager_user ORDER BY username`);
      for (const r of erp.rows as any[]) {
        const u = String(r.username);
        if (byName.has(u)) continue;
        byName.set(u, { username: u, name: r.name_1 || u, role: "admin", active: true, permissions: {}, source: "erp" });
      }
    } catch {
      /* ERP table unreachable — v2 users still returned */
    }

    return { success: true, data: [...byName.values()].sort((a, b) => a.username.localeCompare(b.username)) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createUser(body: {
  username?: string;
  name?: string;
  password?: string;
  role?: string;
  permissions?: unknown;
}): Promise<{ success: true } | Fail> {
  try {
    await requireAdmin();
    await ensureUsersSchema();
    const username = clean(body?.username);
    const password = clean(body?.password);
    if (!username) return fail("ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້");
    if (password.length < 4) return fail("ລະຫັດຜ່ານຕ້ອງຍາວຢ່າງໜ້ອຍ 4 ຕົວ");

    const dup = await query(`SELECT username FROM odg_app_user WHERE username = $1 LIMIT 1`, [username]);
    if (dup.rows.length) return fail("ຊື່ຜູ້ໃຊ້ນີ້ມີໃນລະບົບແລ້ວ");

    const role = asRole(body?.role);
    const perms = usesPermissionMatrix(role) ? normalizePermissions(body?.permissions) : {};
    await query(
      `INSERT INTO odg_app_user (username, name, password_hash, role, active, permissions)
       VALUES ($1, $2, $3, $4, true, $5::jsonb)`,
      [username, clean(body?.name) || username, bcrypt.hashSync(password, 10), role, JSON.stringify(perms)],
    );
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function updateUser(
  username: string,
  body: { name?: string; role?: string; active?: boolean; password?: string; permissions?: unknown },
): Promise<{ success: true } | Fail> {
  try {
    await requireAdmin();
    await ensureUsersSchema();
    const u = clean(username);
    if (!u) return fail("ບໍ່ພົບຜູ້ໃຊ້");

    const role = asRole(body?.role);
    const perms = usesPermissionMatrix(role) ? normalizePermissions(body?.permissions) : {};
    const sets: string[] = [
      "name = $2",
      "role = $3",
      "permissions = $4::jsonb",
      "active = $5",
      "updated_at = now()",
    ];
    const params: unknown[] = [u, clean(body?.name) || u, role, JSON.stringify(perms), body?.active !== false];

    const password = clean(body?.password);
    if (password) {
      if (password.length < 4) return fail("ລະຫັດຜ່ານຕ້ອງຍາວຢ່າງໜ້ອຍ 4 ຕົວ");
      params.push(bcrypt.hashSync(password, 10));
      sets.push(`password_hash = $${params.length}`);
    }

    // UPSERT so an ERP-only user can be configured for the first time.
    const existing = await query(`SELECT username FROM odg_app_user WHERE username = $1 LIMIT 1`, [u]);
    if (existing.rows.length) {
      await query(`UPDATE odg_app_user SET ${sets.join(", ")} WHERE username = $1`, params);
    } else {
      await query(
        `INSERT INTO odg_app_user (username, name, role, permissions, active, password_hash)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
        [u, clean(body?.name) || u, role, JSON.stringify(perms), body?.active !== false, password ? bcrypt.hashSync(password, 10) : null],
      );
    }
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteUser(username: string): Promise<{ success: true } | Fail> {
  try {
    const me = await requireAdmin();
    await ensureUsersSchema();
    const u = clean(username);
    if (!u) return fail("ບໍ່ພົບຜູ້ໃຊ້");
    if (u === me.username) return fail("ລຶບບັນຊີຕົນເອງບໍ່ໄດ້");
    await query(`DELETE FROM odg_app_user WHERE username = $1`, [u]);
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}
