export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { servePublicOrLegacy } from "@/_lib/files";

export async function GET(_request, { params }) {
  const resolvedParams = await params;
  const filePath = Array.isArray(resolvedParams.file) ? resolvedParams.file.join("/") : "";
  return servePublicOrLegacy(`uploads/project_requests/${filePath}`);
}
