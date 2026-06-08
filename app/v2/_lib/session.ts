/**
 * v2 (rebuild) client-side session helpers.
 *
 * The rebuild uses a FLAT permission model: any authenticated user has full
 * access — there are no roles. We store a minimal user object under a
 * v2-specific localStorage key so the rebuild never clobbers the legacy app's
 * `user`/`token` keys (the two apps can coexist during the cut-over).
 *
 * Authentication itself reuses the existing read-only `login` server action
 * (it only SELECTs the user + sets the shared `odg-auth` session cookie).
 */
export type V2User = {
  username: string;
  name: string;
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
