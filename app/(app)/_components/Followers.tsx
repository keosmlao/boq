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

const initial = (s: string) => (s || "?").replace(/[^\p{L}\p{N}]/u, "").charAt(0).toUpperCase() || "?";
const AV = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
const toneFor = (s: string) => AV[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export default function Followers({ entityType, entityId }: { entityType: string; entityId: string | number }) {
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
        <button onClick={() => setOpen((o) => !o)} className="flex items-center -space-x-1.5" title="ຜູ້ຕິດຕາມ">
          {followers.slice(0, 4).map((f) => (
            <span key={f.username} className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ring-2 ring-white ${toneFor(f.username)}`}>
              {initial(f.name || f.username)}
            </span>
          ))}
          {followers.length > 4 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[9px] font-black text-slate-500 ring-2 ring-white">+{followers.length - 4}</span>
          )}
        </button>
      )}

      {/* Follow toggle */}
      <button
        onClick={toggleSelf}
        disabled={busy}
        className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-bold transition active:scale-95 ${following ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : following ? <Check size={12} /> : <UserPlus size={12} />}
        {following ? "ກຳລັງติดตาม" : "ติดตาม"}
      </button>

      {/* Manage dropdown */}
      <button onClick={() => setOpen((o) => !o)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600" title="ຈັດການຜູ້ຕິດຕາມ">
        <Users size={13} />
      </button>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_45px_-12px_rgba(15,23,42,0.28)] animate-scale-up">
            <div className="border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
              ຜູ້ຕິດຕາມ ({followers.length})
            </div>
            <div className="max-h-44 overflow-y-auto py-1">
              {followers.length === 0 ? (
                <div className="px-3.5 py-3 text-[12px] font-semibold text-slate-400">ຍັງບໍ່ມีผู้ติดตาม</div>
              ) : followers.map((f) => (
                <div key={f.username} className="group flex items-center gap-2 px-3 py-1.5">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${toneFor(f.username)}`}>{initial(f.name || f.username)}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-700">{f.name || f.username}</span>
                  <button onClick={() => remove(f.username)} className="rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100" title="เอาออก">
                    <UserMinus size={13} />
                  </button>
                </div>
              ))}
            </div>
            {notFollowing.length > 0 && (
              <div className="border-t border-slate-100">
                <div className="px-3.5 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ເພີ່ມ</div>
                <div className="max-h-36 overflow-y-auto py-1">
                  {notFollowing.map((u) => (
                    <button key={u.username} onClick={() => add(u)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-blue-50/50">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${toneFor(u.username)}`}>{initial(u.name)}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-600">{u.name}</span>
                      <UserPlus size={13} className="text-slate-300" />
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
