"use client";

/**
 * Global live chat — one shared room for every user. A floating launcher in the
 * corner opens a chat panel. Polls for new messages (incrementally by id) every
 * few seconds; faster while open, slower while closed (just for the unread badge).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Users } from "lucide-react";
import { type ChatMessage } from "@/_lib/chat-core";
import { getV2User } from "../../_lib/session";

const OPEN_POLL = 3000;
const IDLE_POLL = 14000;

const initial = (s: string) => (s || "?").replace(/[^\p{L}\p{N}]/u, "").charAt(0).toUpperCase() || "?";
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
};
const AV = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
const toneFor = (s: string) => AV[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readWm, setReadWm] = useState(0); // newest msg id read by someone else → "read" receipts

  const lastId = useRef(0);
  const lastRead = useRef(0); // persisted: newest message id the user has seen
  const openRef = useRef(false);
  const busy = useRef(false);
  const me = useRef("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const markRead = useCallback(() => {
    lastRead.current = lastId.current;
    try { localStorage.setItem("odg_chat_lastread", String(lastRead.current)); } catch {}
  }, []);

  useEffect(() => {
    me.current = getV2User()?.username || "";
    const v = Number(localStorage.getItem("odg_chat_lastread") || 0);
    lastRead.current = Number.isFinite(v) ? v : 0;
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const params = new URLSearchParams();
      if (lastId.current) params.set("sinceId", String(lastId.current));
      if (openRef.current) params.set("markRead", "1"); // server marks read up to newest
      const qs = params.toString();
      const resp = await fetch(`/api/chat${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const json = resp.ok ? await resp.json().catch(() => null) : null;
      if (json?.readWatermark != null) setReadWm(Number(json.readWatermark) || 0);
      const res = { success: resp.ok, data: (json?.data as ChatMessage[]) || [] };
      if (res.success && res.data.length) {
        const fresh = res.data;
        lastId.current = Math.max(lastId.current, ...fresh.map((m) => Number(m.id)));
        setMsgs((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev, ...fresh.filter((m) => !seen.has(m.id))];
          return merged.slice(-300);
        });
        if (!openRef.current) {
          // Only count messages newer than what the user has already seen.
          const incoming = fresh.filter((m) => m.username !== me.current && Number(m.id) > lastRead.current).length;
          if (incoming) setUnread((u) => u + incoming);
        } else {
          markRead();
          scrollToBottom();
        }
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [scrollToBottom, markRead]);

  // Initial load + adaptive polling.
  useEffect(() => {
    poll();
    let timer: ReturnType<typeof setInterval>;
    const arm = () => {
      clearInterval(timer);
      timer = setInterval(poll, openRef.current ? OPEN_POLL : IDLE_POLL);
    };
    arm();
    const onVis = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVis);
    // Re-arm when open state flips (handled by effect dep below via a custom event).
    const reArm = () => arm();
    window.addEventListener("odg-chat-rearm", reArm);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("odg-chat-rearm", reArm);
    };
  }, [poll]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      openRef.current = next;
      if (next) {
        setUnread(0);
        markRead();
        scrollToBottom();
      }
      window.dispatchEvent(new Event("odg-chat-rearm"));
      return next;
    });
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const resp = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const json = await resp.json().catch(() => null);
      const res = { success: resp.ok && json?.success !== false, data: json?.data as ChatMessage };
      if (res.success && res.data) {
        lastId.current = Math.max(lastId.current, Number(res.data.id));
        setMsgs((prev) => (prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data].slice(-300)));
        scrollToBottom();
      } else {
        setText(body); // restore on failure
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={toggle}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:-translate-y-0.5 hover:bg-blue-700 active:scale-95"
          title="ແชັດ"
        >
          <MessageCircle size={24} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(560px,80vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 animate-scale-up">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
              <Users size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-black leading-tight">ແชັດທີມ</div>
              <div className="text-[10.5px] font-medium text-white/80">ຫ້ອງລວມ · ທຸກຄົນ</div>
            </div>
            <button onClick={toggle} className="rounded-lg p-1.5 transition hover:bg-white/15" title="ປິດ">
              <X size={17} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/50 px-3 py-3">
            {loading && msgs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-300">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : msgs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[12px] font-semibold text-slate-400">
                <MessageCircle size={26} className="text-slate-200" />
                ຍັງບໍ່ມີຂໍ້ຄວາມ — ທັກທາຍກ່ອນເລີຍ 👋
              </div>
            ) : (
              msgs.map((m) => {
                const mine = m.username === me.current;
                return (
                  <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    {!mine && (
                      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${toneFor(m.username || m.user_name || "?")}`}>
                        {initial(m.user_name || m.username || "?")}
                      </span>
                    )}
                    <div className={`min-w-0 max-w-[78%] ${mine ? "items-end text-right" : ""}`}>
                      {!mine && <div className="mb-0.5 px-1 text-[10.5px] font-bold text-slate-500">{m.user_name || m.username}</div>}
                      <div className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[12.5px] leading-relaxed ${mine ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
                        {m.body}
                      </div>
                      <div className="mt-0.5 px-1 text-[9.5px] font-medium text-slate-400">
                        {hhmm(m.created_at)}
                        {mine && (
                          <span className={Number(m.id) <= readWm ? "text-blue-500" : "text-slate-400"}>
                            {" · "}{Number(m.id) <= readWm ? "ອ່ານແລ້ວ" : "ສົ່ງແລ້ວ"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <div className="flex items-end gap-2 border-t border-slate-100 bg-white px-3 py-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="ພິມຂໍ້ຄວາມ... (Enter ສົ່ງ)"
              className="max-h-24 min-h-[40px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15"
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
      )}
    </>
  );
}
