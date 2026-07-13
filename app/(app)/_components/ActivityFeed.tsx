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
import { useT } from "@/_lib/i18n";
import ActivitiesPanel from "./ActivitiesPanel";
import Followers from "./Followers";

const POLL_MS = 4000;

const initial = (s: string) => (s || "?").replace(/[^\p{L}\p{N}]/u, "").charAt(0).toUpperCase() || "?";

function makeRelTime(t: ReturnType<typeof useT>) {
  return (iso: string): string => {
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return "";
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return t("components.relTime.now", "ຫາກໍ່");
    if (s < 3600) return `${Math.floor(s / 60)} ${t("components.relTime.minutesAgo", "ນາທີກ່ອນ")}`;
    if (s < 86400) return `${Math.floor(s / 3600)} ${t("components.relTime.hoursAgo", "ຊົ່ວໂມງກ່ອນ")}`;
    if (s < 604800) return `${Math.floor(s / 86400)} ${t("components.relTime.daysAgo", "ມື້ກ່ອນ")}`;
    return new Date(iso).toLocaleDateString("en-GB");
  };
}

/** Avatar tints — token-driven so they read correctly in light and dark. */
const AVATAR_TONES = [
  "bg-[var(--brand-soft)] text-[var(--brand-strong)]",
  "bg-[var(--info-soft)] text-[var(--info)]",
  "bg-[var(--success-soft)] text-[var(--success)]",
  "bg-[var(--warning-soft)] text-[var(--warning)]",
  "bg-[var(--danger-soft)] text-[var(--danger)]",
  "bg-[var(--surface-sunken)] text-[var(--text-soft)]",
];
const toneFor = (s: string) => AVATAR_TONES[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];

export default function ActivityFeed({
  entityType,
  entityId,
  title,
}: {
  entityType: string;
  entityId: string | number;
  title?: string;
}) {
  const t = useT();
  const relTime = makeRelTime(t);
  const titleText = title ?? t("components.activityFeed.title", "ການສົນທະນາ / ບັນທຶກ");
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
    <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <ActivitiesPanel entityType={entityType} entityId={id} />
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-5 py-3.5">
        <MessageSquare size={16} className="text-[var(--brand)]" />
        <h2 className="text-[13px] font-black text-[var(--text)]">{titleText}</h2>
        {items.length > 0 && (
          <span className="rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-soft)]">{items.length}</span>
        )}
        <div className="ml-auto">
          <Followers entityType={entityType} entityId={id} />
        </div>
      </div>

      {/* Timeline */}
      <div className="max-h-[460px] space-y-1 overflow-y-auto px-3 py-3">
        {loading && items.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-[var(--text-mute)]">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1.5 text-[12px] font-semibold text-[var(--text-mute)]">
            <MessageSquare size={24} className="opacity-40" />
            {t("components.activityFeed.empty", "ຍັງບໍ່ມີຂໍ້ຄວາມ — ເລີ່ມການສົນທະນາ")}
          </div>
        ) : (
          items.map((it) =>
            it.kind === "activity" ? (
              <div key={it.id} className="flex items-center gap-2.5 px-2 py-1.5 text-[11.5px] text-[var(--text-mute)]">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--text-mute)]">
                  <Activity size={12} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-[var(--text-soft)]">{it.user_name || t("components.activityFeed.system", "ລະບົບ")}</span>{" "}
                  {it.action || t("components.activityFeed.acted", "ດຳເນີນການ")}
                  {it.body ? <span className="text-[var(--text-mute)]"> — {it.body}</span> : null}
                </span>
                <span className="flex-shrink-0 text-[10.5px] text-[var(--text-mute)]">{relTime(it.created_at)}</span>
              </div>
            ) : (
              <div key={it.id} className="group flex gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-sunken)]">
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[12px] font-black ${toneFor(it.username || it.user_name || "?")}`}>
                  {initial(it.user_name || it.username || "?")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-bold text-[var(--text)]">{it.user_name || it.username || t("components.activityFeed.unknownUser", "ບໍ່ຮູ້ຊື່")}</span>
                    <span className="flex-shrink-0 text-[10.5px] font-medium text-[var(--text-mute)]">{relTime(it.created_at)}</span>
                    {it.username && it.username === me.current && (
                      <button
                        onClick={() => remove(it.id)}
                        className="ml-auto flex-shrink-0 rounded-md p-1 text-[var(--text-mute)] opacity-0 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] group-hover:opacity-100"
                        title={t("common.delete", "ລຶບ")}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-[var(--text-soft)]">{it.body}</p>
                </div>
              </div>
            ),
          )
        )}
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-[var(--border-soft)] px-3 py-3">
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
          placeholder={t("components.activityFeed.composerPlaceholder", "ຂຽນຂໍ້ຄວາມ... (Ctrl/⌘ + Enter ສົ່ງ)")}
          className="max-h-28 min-h-[40px] flex-1 resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-mute)] focus:border-[var(--brand)] focus:ring-3 focus:ring-[var(--brand-ring)]"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || sending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--ink-text)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--ink-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      </div>
    </div>
  );
}
