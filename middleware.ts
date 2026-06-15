import { NextResponse } from "next/server";
import { verifySession } from "./app/_lib/auth_session";
import { canView, isManager, moduleForPath, USERS_HREF } from "./app/_lib/permissions";

const PUBLIC_PATHS = ["/login", "/unauthorized", "/v2/login"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public pages, API routes, and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.startsWith("/uploads/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie (set during login)
  const authCookie = request.cookies.get("odg-auth");
  if (!authCookie?.value) {
    return NextResponse.redirect(new URL("/v2/login", request.url));
  }

  // Verify JWT session
  const session = await verifySession(authCookie.value);
  if (!session) {
    return NextResponse.redirect(new URL("/v2/login", request.url));
  }

  // RBAC route gating. The token carries role + per-module permissions.
  const accessUser = { role: session.role, permissions: session.perms };

  // User-management area is manager/admin only.
  if (pathname === USERS_HREF || pathname.startsWith(USERS_HREF + "/")) {
    if (!isManager(accessUser)) return NextResponse.redirect(new URL("/v2", request.url));
    return NextResponse.next();
  }

  // Business modules: need `view` on the module that owns this path.
  const mod = moduleForPath(pathname);
  if (mod && !canView(accessUser, mod.key)) {
    return NextResponse.redirect(new URL("/v2", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
