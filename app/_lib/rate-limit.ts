/**
 * Tiny in-memory login throttle (per-username) to blunt brute-force attempts.
 *
 * Scope: single server instance (resets on restart). For multi-instance deploys
 * move this to a shared store (Redis/DB) — the API stays the same.
 */
const MAX_FAILS = 5; // fails allowed within the window before a lockout
const WINDOW_MS = 15 * 60_000; // counting window
const BLOCK_MS = 15 * 60_000; // lockout duration once tripped

type Entry = { count: number; first: number; blockedUntil: number };
const attempts = new Map<string, Entry>();

const norm = (k: string) => String(k ?? "").trim().toLowerCase();

/** Is this key currently allowed to attempt a login? */
export function checkLoginAllowed(key: string): { ok: boolean; retryAfterSec?: number } {
  const e = attempts.get(norm(key));
  if (!e) return { ok: true };
  const now = Date.now();
  if (e.blockedUntil > now) return { ok: false, retryAfterSec: Math.ceil((e.blockedUntil - now) / 1000) };
  return { ok: true };
}

/** Record a failed login; trips a lockout after MAX_FAILS within the window. */
export function recordLoginFailure(key: string): void {
  const k = norm(key);
  const now = Date.now();
  let e = attempts.get(k);
  if (!e || now - e.first > WINDOW_MS) e = { count: 0, first: now, blockedUntil: 0 };
  e.count += 1;
  if (e.count >= MAX_FAILS) e.blockedUntil = now + BLOCK_MS;
  attempts.set(k, e);
}

/** Clear the counter on a successful login. */
export function recordLoginSuccess(key: string): void {
  attempts.delete(norm(key));
}
