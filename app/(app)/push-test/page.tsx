"use client";

/** Admin tool: check the push pipeline and send a test notification. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCircle2, XCircle, RefreshCw, Send, Loader2, Smartphone } from "lucide-react";
import { Page, PageHeader, Card } from "../_components/ui";
import { getV2User } from "../../_lib/session";

type Device = { employee_code: string; name: string; tokens: number; platforms: string };
type Status = { configured: boolean; totalTokens: number; devices: Device[] };

export default function PushTestPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const u = getV2User();
    if (!u || String(u.role).toLowerCase() !== "admin") router.replace("/");
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/push-status", { cache: "no-store" });
      if (r.ok) setStatus(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendTest = async (employeeCode: string) => {
    if (!employeeCode || sending) return;
    setSending(true);
    setResult(null);
    try {
      const r = await fetch("/api/push-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode }),
      });
      const j = await r.json().catch(() => ({}));
      setResult({ ok: r.ok && j?.ok !== false, message: j?.message || (r.ok ? "ສຳເລັດ" : "ບໍ່ສຳເລັດ") });
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Page max="max-w-2xl">
      <PageHeader title="ທົດສອບການແຈ້ງເຕືອນ" subtitle="ກວດ Firebase ແລະ ສົ່ງ push ທົດສອບໄປຫາແອັບຊ່າງ" />

      {/* Status */}
      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13.5px] font-bold text-[var(--theme-text)]">ສະຖານະລະບົບ</h2>
          <button onClick={load} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> ໂຫຼດໃໝ່
          </button>
        </div>
        {loading && !status ? (
          <div className="flex items-center gap-2 py-3 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> ກຳລັງໂຫຼດ...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className={`flex items-center gap-2.5 rounded-xl border p-3 ${status?.configured ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
              {status?.configured ? <CheckCircle2 size={20} className="text-emerald-600" /> : <XCircle size={20} className="text-rose-600" />}
              <div>
                <div className="text-[12px] font-bold text-slate-700">Firebase</div>
                <div className={`text-[11.5px] font-semibold ${status?.configured ? "text-emerald-700" : "text-rose-700"}`}>
                  {status?.configured ? "ຕັ້ງຄ່າແລ້ວ" : "ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
              <Smartphone size={20} className="text-blue-600" />
              <div>
                <div className="text-[12px] font-bold text-slate-700">Device ທັງໝົດ</div>
                <div className="text-[11.5px] font-semibold text-slate-500">{status?.totalTokens ?? 0} ໜ່ວຍ</div>
              </div>
            </div>
          </div>
        )}
        {status && !status.configured && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] font-medium text-amber-700">
            ວາງໄຟລ໌ <b>firebase-service-account.json</b> (project ດຽວກັນກັບແອັບ) ໄວ້ໃນ root server ແລ້ວ restart.
          </p>
        )}
      </Card>

      {/* Manual send */}
      <Card className="mb-4 p-4">
        <h2 className="mb-2 text-[13.5px] font-bold text-[var(--theme-text)]">ສົ່ງທົດສອບດ້ວຍລະຫັດພະນັກງານ</h2>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ລະຫັດພະນັກງານ / employee_code (ເຊັ່ນ 21012)"
            className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/12"
          />
          <button
            onClick={() => sendTest(code.trim())}
            disabled={!code.trim() || sending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-[13px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} ສົ່ງ
          </button>
        </div>
        {result && (
          <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {result.message}
          </div>
        )}
      </Card>

      {/* Registered devices */}
      <Card className="p-4">
        <h2 className="mb-3 text-[13.5px] font-bold text-[var(--theme-text)]">ຊ່າງທີ່ລົງທະບຽນ device ({status?.devices?.length ?? 0})</h2>
        {!status?.devices?.length ? (
          <p className="py-4 text-center text-[12px] text-slate-400">ຍັງບໍ່ມີຊ່າງລົງທະບຽນ — ຊ່າງຕ້ອງ login ໃນແອັບ ແລະ ກົດອະນຸຍາດແຈ້ງເຕືອນ</p>
        ) : (
          <div className="space-y-2">
            {status.devices.map((d) => (
              <div key={d.employee_code} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Bell size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-slate-700">{d.name}</div>
                  <div className="text-[11px] text-slate-400">{d.employee_code} · {d.tokens} device · {d.platforms}</div>
                </div>
                <button
                  onClick={() => sendTest(d.employee_code)}
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11.5px] font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                >
                  <BellRing size={13} /> ສົ່ງທົດສອບ
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
