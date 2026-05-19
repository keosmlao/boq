import path from "path";
import { access, mkdir, readFile, writeFile } from "fs/promises";

const LEGACY_ASSET_BASE_URL =
  process.env.LEGACY_ASSET_BASE_URL ||
  process.env.NEXT_PUBLIC_LEGACY_ASSET_BASE_URL ||
  "http://119.59.102.23:2233";

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
  const fullPath = path.join(process.cwd(), "public", relativePath);
  if (!(await exists(fullPath))) {
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
  const fullPath = path.join(process.cwd(), "public", relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);
}

export async function servePublicOrLegacy(relativePath) {
  const normalizedPath = relativePath.replace(/^\/+/, "");
  const localResponse = await readLocalFile(normalizedPath);
  if (localResponse) return localResponse;

  const fileName = path.basename(normalizedPath).toLowerCase();
  if (PLACEHOLDER_FILENAMES.has(fileName)) {
    return new Response("Not found", { status: 404 });
  }

  const legacyUrl = new URL(normalizedPath, `${LEGACY_ASSET_BASE_URL.replace(/\/+$/, "")}/`);
  let legacyResponse;

  try {
    legacyResponse = await fetch(legacyUrl, {
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
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
