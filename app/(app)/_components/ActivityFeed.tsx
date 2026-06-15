"use client";

/**
 * Chatter + activity timeline for a single record. Mixes user comments and
 * system activities, polls every few seconds, and lets the signed-in user post.
 * Mount on document detail pages: <ActivityFeed entityType="project" entityId={id} />
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2, Trash2, Activity } from "lucide-react";
import { getFeed, addComment, deleteFeedItem, type FeedItem } from "@/_actions/chatter";
import { getV2User } from "../../_lib/session";
import ActivitiesPanel from "./ActivitiesPanel";

const POLL_MS = 4000;

const initial = (s: string) => (s || "?").replace(/[^\p{L}\p{N}]/u, "").charAt(0).toUpperCase() || "?";

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "ຫາກໍ່";
  if (s < 3600) return `${Math.floor(s / 60)} ນາທີກ່ອນ`;
  if (s < 86400) return `${Math.floor(s / 3600)} ຊົ່ວໂມງກ່ອນ`;
  if (s < 604800) return `${Math.floor(s / 86400)} ມື້ກ່ອນ`;
  return new Date(iso).toLocaleDateString("en-GB");
}

const AVATAR_TONES = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
const toneFor = (s: string) => AVATAR_TONES[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];

export default function ActivityFeed({
  entityType,
  entityId,
  title = "ການສົນທະນາ / ບັນທຶກ",
}: {
  entityType: string;
  entityId: string | number;
  title?: string;
}) {
  const id = String(entityId ?? "");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const me = useRef<string>("");
  const busy = useRef(false);

  useEffect(() => {
    me.current = getV2User()?.username || "";
  }, []);

  const load = useCallback(async () => {
    if (busy.current || !id) return;
    busy.current = true;
    try {
      const res = await getFeed(entityType, id);
      if (res?.success) setItems(res.data);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [entityType, id]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await addComment(entityType, id, body);
      if (res?.success) {
        setItems((prev) => [...prev, res.data]);
        setText("");
      }
    } finally {
      setSending(false);
    }
  };

  const remove = async (itemId: string) => {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== itemId));
    const res = await deleteFeedItem(itemId);
    if (!res?.success) setItems(prev); // rollback
  };

  return (
    <div className="space-y-4">
      <ActivitiesPanel entityType={entityType} entityId={id} />
      <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <MessageSquare size={16} className="text-blue-600" />
        <h2 className="text-[13px] font-black text-slate-800">{title}</h2>
        {items.length > 0 && (
          <span className="ml-auto rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{items.length}</span>
        )}
      </div>

      {/* Timeline */}
      <div className="max-h-[460px] space-y-1 overflow-y-auto px-3 py-3">
        {loading && items.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-slate-300">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1.5 text-[12px] font-semibold text-slate-400">
            <MessageSquare size={24} className="text-slate-200" />
            ຍັງບໍ່ມີຂໍ້ຄວາມ — ເລີ່ມການສົນທະນາ
          </div>
        ) : (
          items.map((it) =>
            it.kind === "activity" ? (
              <div key={it.id} className="flex items-center gap-2.5 px-2 py-1.5 text-[11.5px] text-slate-400">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <Activity size={12} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-slate-600">{it.user_name || "ລະບົບ"}</span>{" "}
                  {it.action || "ດຳເນີນການ"}
                  {it.body ? <span className="text-slate-400"> — {it.body}</span> : null}
                </span>
                <span className="flex-shrink-0 text-[10.5px] text-slate-300">{relTime(it.created_at)}</span>
              </div>
            ) : (
              <div key={it.id} className="group flex gap-2.5 rounded-2xl px-2 py-2 hover:bg-slate-50">
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[12px] font-black ${toneFor(it.username || it.user_name || "?")}`}>
                  {initial(it.user_name || it.username || "?")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-bold text-slate-800">{it.user_name || it.username || "ບໍ່ຮູ້ຊື່"}</span>
                    <span className="flex-shrink-0 text-[10.5px] font-medium text-slate-400">{relTime(it.created_at)}</span>
                    {it.username && it.username === me.current && (
                      <button
                        onClick={() => remove(it.id)}
                        className="ml-auto flex-shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                        title="ລຶບ"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-slate-600">{it.body}</p>
                </div>
              </div>
            ),
          )
        )}
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-slate-100 px-3 py-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="ຂຽນຂໍ້ຄວາມ... (Ctrl/⌘ + Enter ສົ່ງ)"
          className="max-h-28 min-h-[40px] flex-1 resize-y rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || sending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      </div>
    </div>
  );
}
