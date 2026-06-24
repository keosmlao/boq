/**
 * Mobile force-update check (public — no auth needed).
 * The app blocks when its version is below `minVersion`.
 * Configure via env: MOBILE_MIN_VERSION, MOBILE_LATEST_VERSION, MOBILE_UPDATE_URL.
 */
import { NextResponse } from "next/server";

export function GET(req: Request) {
  // Default the download link to this server's own /download page so the
  // force-update button always has somewhere to go without extra config.
  // Behind a reverse proxy `req.url` is the internal bind address (e.g.
  // 0.0.0.0:3003), so derive the public origin from the forwarded headers.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    new URL(req.url).host;
  const origin = `${proto}://${host}`;
  return NextResponse.json({
    minVersion: process.env.MOBILE_MIN_VERSION || "1.0.1",
    latestVersion: process.env.MOBILE_LATEST_VERSION || "1.0.1",
    message: process.env.MOBILE_UPDATE_MESSAGE || "ມີເວີຊັນໃໝ່ ກະລຸນາອັບເດດແອັບກ່ອນໃຊ້ງານຕໍ່",
    url: process.env.MOBILE_UPDATE_URL || `${origin}/download`,
  });
}
