/**
 * Tiny in-memory TTL cache for expensive list queries.
 *
 * Used to dedupe heavy DB list-loads across rapid navigations from the same
 * server instance. Invalidate via `invalidate(prefix)` (e.g. after a write).
 *
 * Not cluster-aware — each Node process keeps its own cache. For a multi-
 * instance deployment, swap this for Redis. For now, single-instance is fine.
 */

type Entry<T> = {
  value: Promise<T>;
  expiresAt: number;
};

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  // Cache the in-flight promise so concurrent callers don't all run the loader.
  const value = loader().catch((err) => {
    // Drop the entry on failure so the next call retries.
    if (store.get(key)?.value === value) store.delete(key);
    throw err;
  });
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/**
 * Drop every cache entry whose key starts with `prefix`. Call this from any
 * server action that mutates the underlying data so the next read goes to DB.
 */
export function invalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function invalidateAll(): void {
  store.clear();
}
