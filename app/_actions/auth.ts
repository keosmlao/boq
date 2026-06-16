"use server";

import { cookies } from "next/headers";
import { getSalesStats } from "@/_lib/projects";
import { signSession } from "@/_lib/auth_session";
import { type Permissions } from "@/_lib/permissions";
import { authenticateUser, isDbConnectionError } from "@/_lib/auth-core";
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from "@/_lib/rate-limit";

type Fail = { success: false; message: string };
function fail(message: string): Fail { return { success: false, message }; }

export async function login(input: { username: string; password: string }): Promise<
  { success: true; username: string; role: string; name_1: string; permissions: Permissions } | Fail
> {
  try {
    const gate = checkLoginAllowed(input?.username);
    if (!gate.ok) return fail(`ລອງຫຼາຍຄັ້ງເກີນໄປ — ກະລຸນາລໍຖ້າ ${Math.ceil((gate.retryAfterSec || 0) / 60)} ນາທີ`);
    const res = await authenticateUser(input?.username, input?.password);
    if (!res.ok) {
      recordLoginFailure(input?.username);
      return fail((res as { message?: string }).message || "ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ");
    }
    recordLoginSuccess(input?.username);
    const { username, role, name, permissions } = res.user;

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
