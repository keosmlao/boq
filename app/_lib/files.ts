import path from "path";
import { access, mkdir, readFile, writeFile } from "fs/promises";

const LEGACY_ASSET_BASE_URL =
  process.env.LEGACY_ASSET_BASE_URL ||
  process.env.NEXT_PUBLIC_LEGACY_ASSET_BASE_URL ||
  "http://119.59.102.23:2233";

// Legacy asset host fetch tuning. The old image host is often unreachable, and
// a 5s hang per missing image (with many images on a page) made the app crawl.
// Fail fast, and use a circuit breaker: after one failure, skip the legacy
// fetch entirely for a cool-down window so subsequent misses 404 instantly.
const LEGACY_DISABLED =
  process.env.LEGACY_ASSETS_DISABLED === "1" || !LEGACY_ASSET_BASE_URL;
const LEGACY_TIMEOUT_MS = Number(process.env.LEGACY_ASSET_TIMEOUT_MS || 2000);
const LEGACY_COOLDOWN_MS = Number(process.env.LEGACY_ASSET_COOLDOWN_MS || 60000);
let legacyDownUntil = 0;

const MIME_TYPES = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

const PLACEHOLDER_FILENAMES = new Set([
  "no_image.jpg",
  "no-image.jpg",
  "no_image.png",
  "no-image.png",
]);

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

/**
 * Resolve `relativePath` under public/ and return the absolute path ONLY if it
 * stays inside public/. Returns null on any `..` escape — closes path traversal
 * on both the local read and the legacy-cache write.
 */
function resolvePublicPath(relativePath: string): string | null {
  const full = path.resolve(PUBLIC_DIR, relativePath);
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + path.sep)) return null;
  return full;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getContentType(filePath: string, fallback?: string) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || fallback || "application/octet-stream";
}

async function readLocalFile(relativePath) {
  const fullPath = resolvePublicPath(relativePath);
  if (!fullPath || !(await exists(fullPath))) {
    return null;
  }

  const bytes = await readFile(fullPath);
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": getContentType(fullPath),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

async function cacheLegacyFile(relativePath, bytes) {
  const fullPath = resolvePublicPath(relativePath);
  if (!fullPath) return; // refuse to write outside public/
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);
}

export async function servePublicOrLegacy(relativePath) {
  const normalizedPath = relativePath.replace(/^\/+/, "");
  // Reject any traversal up front so it never reaches the local read or the
  // legacy fetch/cache write.
  if (!resolvePublicPath(normalizedPath)) {
    return new Response("Not found", { status: 404 });
  }
  const localResponse = await readLocalFile(normalizedPath);
  if (localResponse) return localResponse;

  const fileName = path.basename(normalizedPath).toLowerCase();
  if (PLACEHOLDER_FILENAMES.has(fileName)) {
    return new Response("Not found", { status: 404 });
  }

  // Fail fast: legacy disabled, or breaker is open after a recent failure.
  if (LEGACY_DISABLED || Date.now() < legacyDownUntil) {
    return new Response("Not found", { status: 404 });
  }

  const legacyUrl = new URL(normalizedPath, `${LEGACY_ASSET_BASE_URL.replace(/\/+$/, "")}/`);
  let legacyResponse;

  try {
    legacyResponse = await fetch(legacyUrl, {
      signal: AbortSignal.timeout(LEGACY_TIMEOUT_MS),
    });
  } catch {
    // Host unreachable/timed out → open the breaker so the next misses are instant.
    legacyDownUntil = Date.now() + LEGACY_COOLDOWN_MS;
    return new Response("Not found", { status: 404 });
  }

  if (!legacyResponse.ok) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = Buffer.from(await legacyResponse.arrayBuffer());
  await cacheLegacyFile(normalizedPath, bytes);

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": getContentType(normalizedPath, legacyResponse.headers.get("content-type")),
      "cache-control": "public, max-age=86400",
    },
  });
}
