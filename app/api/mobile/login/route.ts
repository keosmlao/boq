/** Mobile login → JWT (same token shape as the web cookie session). */
import { NextResponse } from "next/server";
import { authenticateUser } from "@/_lib/auth-core";
import { signSession } from "@/_lib/auth_session";
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from "@/_lib/rate-limit";
import { query } from "@/_lib/db";

/**
 * App access: craftsmen (ຊ່າງ/ຜູ້ຊ່ວຍ) + managers/admins only.
 * Returns the craftsman sub-role from odg_technicians.role so the app can render
 * the right pages (technician/assistant); null for managers/admins.
 */
async function appAccess(username: string, role: string): Promise<{ allowed: boolean; craftRole: string | null }> {
  if (role === "admin" || role === "manager") return { allowed: true, craftRole: null };
  try {
    const r = await query(
      `SELECT lower(coalesce(role, '')) AS role FROM odg_technicians WHERE code = $1 LIMIT 1`,
      [username],
    );
    const craftRole = (r.rows[0]?.role as string | undefined) || null;
    return { allowed: craftRole === "technician" || craftRole === "assistant", craftRole };
  } catch {
    return { allowed: false, craftRole: null };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const gate = checkLoginAllowed(body?.username);
    if (!gate.ok) return NextResponse.json({ error: "ລອງຫຼາຍຄັ້ງເກີນໄປ ກະລຸນາລໍຖ້າ" }, { status: 429 });
    const res = await authenticateUser(body?.username, body?.password);
    if (!res.ok) {
      recordLoginFailure(body?.username);
      return NextResponse.json({ error: (res as { message?: string }).message || "login failed" }, { status: 401 });
    }
    recordLoginSuccess(body?.username);
    const { username, role, name, permissions } = res.user;
    const access = await appAccess(username, role);
    if (!access.allowed) {
      return NextResponse.json(
        { error: "ບັນຊີນີ້ບໍ່ມີສິດເຂົ້າໃຊ້ແອັບຊ່າງ (ສະເພາະຊ່າງ ແລະ ຜູ້ຊ່ວຍຊ່າງ)" },
        { status: 403 },
      );
    }
    const token = await signSession({ username, role, name_1: name, perms: permissions });
    return NextResponse.json({ token, user: { username, name, role, permissions, craftRole: access.craftRole } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "login failed" }, { status: 500 });
  }
}
