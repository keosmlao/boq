export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { fail } from "@/_lib/http";

function notImplemented() {
  return fail("This API route has not been migrated into Next.js yet", 404);
}

export const GET = notImplemented;
export const POST = notImplemented;
export const PUT = notImplemented;
export const PATCH = notImplemented;
export const DELETE = notImplemented;
export const OPTIONS = notImplemented;
