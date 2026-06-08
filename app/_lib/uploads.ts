import crypto from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

function sanitizeFileName(fileName) {
  const trimmed = String(fileName || "file").trim();
  const ext = path.extname(trimmed);
  const base = path.basename(trimmed, ext);
  const safeBase = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${safeBase || "file"}${ext}`;
}

async function ensureDir(relativeDir) {
  const fullDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(fullDir, { recursive: true });
  return fullDir;
}

export async function saveWebFile(file, relativeDir) {
  if (!file || typeof file.arrayBuffer !== "function") return null;
  if (typeof file.size === "number" && file.size <= 0) return null;

  const dir = await ensureDir(relativeDir);
  const safeName = sanitizeFileName(file.name);
  const name = `${crypto.randomUUID().replace(/-/g, "")}_${safeName}`;
  const fullPath = path.join(dir, name);
  const bytes = await file.arrayBuffer();

  await writeFile(fullPath, Buffer.from(bytes));

  return `/${relativeDir.replace(/^\/+|\/+$/g, "")}/${name}`;
}

export async function saveBase64File({
  base64,
  fileName,
  relativeDir,
}) {
  if (!base64) return null;

  const dir = await ensureDir(relativeDir);
  const safeName = sanitizeFileName(fileName || "attachment.bin");
  const name = `${crypto.randomUUID().replace(/-/g, "")}_${safeName}`;
  const fullPath = path.join(dir, name);

  await writeFile(fullPath, Buffer.from(base64, "base64"));

  return `/${relativeDir.replace(/^\/+|\/+$/g, "")}/${name}`;
}
