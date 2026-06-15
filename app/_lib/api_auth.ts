import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "./auth_session";

/**
 * Auth guard for API route handlers.
 *
 * `middleware.ts` deliberately skips all `/api/` paths, so route handlers are
 * otherwise PUBLIC — including ones that mutate the shared ERP tables. Call
 * this at the top of every handler and bail when `response` is set:
 *
 *   const { session, response } = await requireSession();
 *   if (response) return response;
 *
 * The flat permission model means any valid session is authorised; this only
 * enforces being-logged-in, matching the page-route middleware.
 */
export async function requireSession(): Promise<
  | { session: Record<string, unknown>; response: null }
  | { session: null; response: NextResponse }
> {
  const token = (await cookies()).get("odg-auth")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, response: null };
}
