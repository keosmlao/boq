/**
 * v2 (rebuild) client-side session helpers.
 *
 * RBAC: every user has a `role` (admin | manager | staff) and a per-module
 * `permissions` map. We mirror it in localStorage (set at login) so the sidebar
 * and buttons can gate client-side; the signed `odg-auth` cookie carries the
 * same data for middleware + server-action enforcement. Stored under a
 * v2-specific key so it never clobbers the legacy app's `user`/`token` keys.
 */
import type { Permissions } from "@/_lib/permissions";

export type V2User = {
  username: string;
  name: string;
  role?: string;
  permissions?: Permissions;
};

const KEY = "v2_user";

export function getV2User(): V2User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as V2User) : null;
  } catch {
    return null;
  }
}

export function setV2User(user: V2User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearV2User(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
