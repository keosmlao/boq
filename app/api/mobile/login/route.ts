/** Mobile login → JWT (same token shape as the web cookie session). */
import { NextResponse } from "next/server";
import { authenticateUser } from "@/_lib/auth-core";
import { signSession } from "@/_lib/auth_session";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const res = await authenticateUser(body?.username, body?.password);
    if (!res.ok) return NextResponse.json({ error: res.message }, { status: 401 });
    const { username, role, name, permissions } = res.user;
    const token = await signSession({ username, role, name_1: name, perms: permissions });
    return NextResponse.json({ token, user: { username, name, role, permissions } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "login failed" }, { status: 500 });
  }
}
