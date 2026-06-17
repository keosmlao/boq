"use client";

/** Admin tool: Firebase Cloud Messaging diagnostics for the Saang mobile app. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCircle2, XCircle, RefreshCw, Send, Loader2, Smartphone, KeyRound } from "lucide-react";
import { Page, PageHeader, Card } from "../_components/ui";
import { getV2User } from "../../_lib/session";
import { useT } from "@/_lib/i18n";

type Device = { employee_code: string; name: string; tokens: number; platforms: string };
type Status = {
  configured: boolean;
  totalTokens: number;
  devices: Device[];
  projectId?: string | null;
  serviceAccountSource?: string | null;
};

function StatusBox({ ok, icon, title, value }: { ok?: boolean; icon: React.ReactNode; title: string; value: string }) {
  const cls = ok == null
    ? "border-slate-200 bg-white"
    : ok
      ? "border-emerald-200 bg-emerald-50"
      : "border-rose-200 bg-rose-50";
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border p-3 ${cls}`}>
      {icon}
      <div>
        <div className="text-[12px] font-bold text-slate-700">{title}</div>
        <div className={`text-[11.5px] font-semibold ${ok == null ? "text-slate-500" : ok ? "text-emerald-700" : "text-rose-700"}`}>{value}</div>
      </div>
    </div>
  );
}

export default function PushTestPage() {
  const router = useRouter();
  const t = useT();
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
      setResult({ ok: r.ok && j?.ok !== false, message: j?.message || (r.ok ? t("common.success", "ສຳເລັດ") : t("common.error", "ບໍ່ສຳເລັດ")) });
      await load();
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Page max="max-w-2xl">
      <PageHeader title={t("pushTest.title", "ທົດສອບ Push ໄປແອັບຊ່າງ")} subtitle={t("pushTest.subtitle", "Firebase Cloud Messaging (FCM) ສຳລັບ mobile app")} />

      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13.5px] font-bold text-[var(--theme-text)]">{t("pushTest.systemStatus", "ສະຖານະລະບົບ Mobile Push")}</h2>
          <button onClick={load} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {t("pushTest.reload", "ໂຫຼດໃໝ່")}
          </button>
        </div>

        {loading && !status ? (
          <div className="flex items-center gap-2 py-3 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> {t("common.loading", "ກຳລັງໂຫຼດ...")}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusBox
              ok={!!status?.configured}
              icon={status?.configured ? <CheckCircle2 size={20} className="text-emerald-600" /> : <XCircle size={20} className="text-rose-600" />}
              title="Firebase Admin"
              value={status?.configured ? t("pushTest.configured", "ຕັ້ງຄ່າແລ້ວ") : t("pushTest.noServiceAccount", "ຍັງບໍ່ມີ service account")}
            />
            <StatusBox
              ok={null}
              icon={<Smartphone size={20} className="text-blue-600" />}
              title="Device token"
              value={`${status?.totalTokens ?? 0} ${t("pushTest.units", "ໜ່ວຍ")}`}
            />
          </div>
        )}

        {status?.projectId && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] font-semibold text-slate-600">
            Firebase project: <b>{status.projectId}</b>{status.serviceAccountSource ? ` · ${status.serviceAccountSource}` : ""}
          </p>
        )}

        {status && !status.configured && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] font-medium text-amber-800">
            <div className="mb-1 flex items-center gap-1.5 font-bold"><KeyRound size={13} /> {t("pushTest.missingServerKey", "ຂາດ server key ສຳລັບສົ່ງ FCM")}</div>
            {t("pushTest.setupHintPre", "ໃຫ້ເອົາ Firebase service account JSON ຂອງ project")} <b>saleproject-36fc8</b> {t("pushTest.setupHintMid", "ມາວາງເປັນ")}
            <b> BOQ2026/firebase-service-account.json</b> {t("pushTest.setupHintOr", "ຫຼືຕັ້ງ")} <b>FIREBASE_SERVICE_ACCOUNT</b> {t("pushTest.setupHintEnv", "ໃນ `.env`, ແລ້ວ restart server.")}
          </div>
        )}
      </Card>

      <Card className="mb-4 p-4">
        <h2 className="mb-2 text-[13.5px] font-bold text-[var(--theme-text)]">{t("pushTest.sendTestTitle", "ສົ່ງທົດສອບໄປແອັບ")}</h2>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("pushTest.codePlaceholder", "employee_code (ເຊັ່ນ 21012)")}
            className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/12"
          />
          <button
            onClick={() => sendTest(code.trim())}
            disabled={!code.trim() || sending || !status?.configured}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-[13px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {t("pushTest.send", "ສົ່ງ")}
          </button>
        </div>
        {result && (
          <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {result.message}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-[13.5px] font-bold text-[var(--theme-text)]">{t("pushTest.registeredDevices", "Device ທີ່ລົງທະບຽນ")} ({status?.devices?.length ?? 0})</h2>
        {!status?.devices?.length ? (
          <p className="py-4 text-center text-[12px] text-slate-400">{t("pushTest.noDevices", "ຍັງບໍ່ມີ device token — ໃຫ້ຊ່າງ login ໃນແອັບກ່ອນ")}</p>
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
                  disabled={sending || !status.configured}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11.5px] font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                >
                  <BellRing size={13} /> {t("pushTest.sendTest", "ສົ່ງທົດສອບ")}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
