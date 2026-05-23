"use server";

import { cookies } from "next/headers";
import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";
import { getSalesStats } from "@/_lib/projects";
import bcrypt from "bcryptjs";
import { signSession } from "@/_lib/auth_session";

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
  { success: true; username: string; role: unknown; name_1: unknown } | Fail
> {
  try {
    const username = cleanText(input?.username);
    const password = cleanText(input?.password);

    if (!username || !password) return fail("ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ");

    const result = await query(
      `SELECT username, password, role, name_1 FROM odg_project_manager_user WHERE username = $1 LIMIT 1`,
      [username],
    );

    const user = result.rows[0];
    if (!user) return fail("ບໍ່ພົບຊື່ຜູ້ໃຊ້ນີ້");

    const dbPassword = cleanText(user.password);
    let isMatch = false;

    if (dbPassword.startsWith("$2a$") || dbPassword.startsWith("$2b$")) {
      isMatch = bcrypt.compareSync(password, dbPassword);
    } else {
      isMatch = dbPassword === password;
    }

    if (!isMatch) return fail("ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ");

    // Sign a secure JWT session token
    const token = await signSession({
      username: user.username,
      role: user.role,
      name_1: user.name_1,
    });

    const cookieStore = await cookies();
    cookieStore.set("odg-auth", token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    return {
      success: true,
      username: user.username,
      role: user.role,
      name_1: user.name_1,
    };
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
