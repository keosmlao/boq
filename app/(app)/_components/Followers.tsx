"use client";

/**
 * Followers control for a record (Odoo-style), shown in the chatter header.
 * Avatar stack + count, a Follow/Following toggle for the current user, and a
 * dropdown to add/remove followers.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Users, UserPlus, UserMinus, Check, X, Loader2 } from "lucide-react";
import { getFollowers, followRecord, unfollowRecord, addFollower, type Follower } from "@/_actions/followers";
import { getAssignableUsers } from "@/_actions/activities";
import { getV2User } from "../../_lib/session";
import { useT } from "@/_lib/i18n";

const initial = (s: string) => (s || "?").replace(/[^\p{L}\p{N}]/u, "").charAt(0).toUpperCase() || "?";
const AV = [
  "bg-[var(--brand-soft)] text-[var(--brand-strong)]",
  "bg-[var(--info-soft)] text-[var(--info)]",
  "bg-[var(--success-soft)] text-[var(--success)]",
  "bg-[var(--warning-soft)] text-[var(--warning)]",
  "bg-[var(--danger-soft)] text-[var(--danger)]",
  "bg-[var(--surface-sunken)] text-[var(--text-soft)]",
];
const toneFor = (s: string) => AV[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export default function Followers({ entityType, entityId }: { entityType: string; entityId: string | number }) {
  const t = useT();
  const id = String(entityId ?? "");
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState(false);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<{ username: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const me = useRef("");

  useEffect(() => { me.current = getV2User()?.username || ""; }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await getFollowers(entityType, id);
    if (res?.success) { setFollowers(res.data.followers); setFollowing(res.data.following); }
  }, [entityType, id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open && !users.length) getAssignableUsers().then((r) => { if (r?.success) setUsers(r.data); }); }, [open, users.length]);

  const toggleSelf = async () => {
    setBusy(true);
    try {
      if (following) { setFollowing(false); await unfollowRecord(entityType, id); }
      else { setFollowing(true); await followRecord(entityType, id); }
      await load();
    } finally { setBusy(false); }
  };

  const add = async (u: { username: string; name: string }) => {
    if (followers.some((f) => f.username === u.username)) return;
    await addFollower(entityType, id, u.username, u.name);
    load();
  };
  const remove = async (username: string) => {
    setFollowers((p) => p.filter((f) => f.username !== username));
    if (username === me.current) setFollowing(false);
    await unfollowRecord(entityType, id, username);
    load();
  };

  const notFollowing = users.filter((u) => !followers.some((f) => f.username === u.username));

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Avatar stack */}
      {followers.length > 0 && (
        <button onClick={() => setOpen((o) => !o)} className="flex items-center -space-x-1.5" title={t("components.followers.followers", "ຜູ້ຕິດຕາມ")}>
          {followers.slice(0, 4).map((f) => (
            <span key={f.username} className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ring-2 ring-[var(--surface)] ${toneFor(f.username)}`}>
              {initial(f.name || f.username)}
            </span>
          ))}
          {followers.length > 4 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[9px] font-black text-[var(--text-soft)] ring-2 ring-[var(--surface)]">+{followers.length - 4}</span>
          )}
        </button>
      )}

      {/* Follow toggle */}
      <button
        onClick={toggleSelf}
        disabled={busy}
        className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-bold transition active:scale-95 ${
          following
            ? "border-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
        }`}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : following ? <Check size={12} /> : <UserPlus size={12} />}
        {following ? t("components.followers.following", "ກຳລັງຕິດຕາມ") : t("components.followers.follow", "ຕິດຕາມ")}
      </button>

      {/* Manage dropdown */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-mute)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
        title={t("components.followers.manage", "ຈັດການຜູ້ຕິດຕາມ")}
      >
        <Users size={13} />
      </button>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] animate-scale-up">
            <div className="border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-3.5 py-2.5 text-[11px] font-black tracking-wider text-[var(--text-mute)]">
              {t("components.followers.followers", "ຜູ້ຕິດຕາມ")} ({followers.length})
            </div>
            <div className="max-h-44 overflow-y-auto py-1">
              {followers.length === 0 ? (
                <div className="px-3.5 py-3 text-[12px] font-semibold text-[var(--text-mute)]">{t("components.followers.empty", "ຍັງບໍ່ມີຜູ້ຕິດຕາມ")}</div>
              ) : followers.map((f) => (
                <div key={f.username} className="group flex items-center gap-2 px-3 py-1.5">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${toneFor(f.username)}`}>{initial(f.name || f.username)}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--text-soft)]">{f.name || f.username}</span>
                  <button
                    onClick={() => remove(f.username)}
                    className="rounded-md p-1 text-[var(--text-mute)] opacity-0 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] group-hover:opacity-100"
                    title={t("components.followers.remove", "ເອົາອອກ")}
                  >
                    <UserMinus size={13} />
                  </button>
                </div>
              ))}
            </div>
            {notFollowing.length > 0 && (
              <div className="border-t border-[var(--border-soft)]">
                <div className="px-3.5 pt-2 text-[10px] font-black tracking-wider text-[var(--text-mute)]">{t("common.add", "ເພີ່ມ")}</div>
                <div className="max-h-36 overflow-y-auto py-1">
                  {notFollowing.map((u) => (
                    <button key={u.username} onClick={() => add(u)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-[var(--brand-tint)]">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${toneFor(u.username)}`}>{initial(u.name)}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--text-soft)]">{u.name}</span>
                      <UserPlus size={13} className="text-[var(--text-mute)]" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
