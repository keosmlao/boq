export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/_lib/db";
import { cleanText, fail, serverError } from "@/_lib/http";

export async function POST(request) {
  try {
    const body = await request.json();
    const username = cleanText(body?.username);
    const password = cleanText(body?.password);

    if (!username || !password) {
      return fail("Username and password are required", 400);
    }

    const result = await query(
      `
        SELECT username, password, role, name_1
        FROM odg_project_manager_user
        WHERE username = $1
        LIMIT 1
      `,
      [username]
    );

    const user = result.rows[0];
    if (!user || cleanText(user.password) !== password) {
      return fail("Invalid username or password", 401);
    }

    const response = NextResponse.json({
      success: true,
      username: user.username,
      role: user.role,
      name_1: user.name_1,
    });

    // Set auth cookie for middleware protection (7 days)
    response.cookies.set("odg-auth", "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    return serverError(error);
  }
}
