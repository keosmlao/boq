/** Mobile login → JWT (same token shape as the web cookie session). */
import { NextResponse } from "next/server";
import { authenticateUser } from "@/_lib/auth-core";
import { signSession } from "@/_lib/auth_session";
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from "@/_lib/rate-limit";

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
    const token = await signSession({ username, role, name_1: name, perms: permissions });
    return NextResponse.json({ token, user: { username, name, role, permissions } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "login failed" }, { status: 500 });
  }
}
