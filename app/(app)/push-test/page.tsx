"use client";

/** Admin tool: Firebase Cloud Messaging diagnostics for the Saang mobile app. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCircle2, XCircle, RefreshCw, Send, Loader2, Smartphone, KeyRound } from "lucide-react";
import { Page, PageHeader, Card, Btn, SectionHeader, inputCls } from "../_components/ui";
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

function StatusBox({ ok, icon, title, value }: { ok?: boolean | null; icon: React.ReactNode; title: string; value: string }) {
  const cls =
    ok == null
      ? "border-[var(--border)] bg-[var(--surface)]"
      : ok
        ? "border-[var(--success-soft)] bg-[var(--success-soft)]"
        : "border-[var(--danger-soft)] bg-[var(--danger-soft)]";
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border p-3 ${cls}`}>
      {icon}
      <div>
        <div className="text-[12px] font-bold text-[var(--text)]">{title}</div>
        <div
          className={`text-[11.5px] font-semibold ${
            ok == null ? "text-[var(--text-mute)]" : ok ? "text-[var(--success)]" : "text-[var(--danger)]"
          }`}
        >
          {value}
        </div>
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
      <PageHeader
        title={t("pushTest.title", "ທົດສອບ Push ໄປແອັບຊ່າງ")}
        subtitle={t("pushTest.subtitle", "Firebase Cloud Messaging (FCM) ສຳລັບ mobile app")}
        actions={
          <Btn variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("pushTest.reload", "ໂຫຼດໃໝ່")}
          </Btn>
        }
      />

      <Card className="mb-4 p-4">
        <SectionHeader icon={<Smartphone size={15} />} title={t("pushTest.systemStatus", "ສະຖານະລະບົບ Mobile Push")} tone="brand" />

        {loading && !status ? (
          <div className="flex items-center gap-2 py-3 text-[12.5px] text-[var(--text-mute)]">
            <Loader2 size={16} className="animate-spin" /> {t("common.loading", "ກຳລັງໂຫຼດ...")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusBox
              ok={!!status?.configured}
              icon={
                status?.configured ? (
                  <CheckCircle2 size={20} className="text-[var(--success)]" />
                ) : (
                  <XCircle size={20} className="text-[var(--danger)]" />
                )
              }
              title="Firebase Admin"
              value={status?.configured ? t("pushTest.configured", "ຕັ້ງຄ່າແລ້ວ") : t("pushTest.noServiceAccount", "ຍັງບໍ່ມີ service account")}
            />
            <StatusBox
              ok={null}
              icon={<Smartphone size={20} className="text-[var(--info)]" />}
              title="Device token"
              value={`${status?.totalTokens ?? 0} ${t("pushTest.units", "ໜ່ວຍ")}`}
            />
          </div>
        )}

        {status?.projectId && (
          <p className="mt-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-[11.5px] font-semibold text-[var(--text-soft)]">
            Firebase project: <b className="text-[var(--text)]">{status.projectId}</b>
            {status.serviceAccountSource ? ` · ${status.serviceAccountSource}` : ""}
          </p>
        )}

        {status && !status.configured && (
          <div className="mt-3 rounded-lg border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-3 py-2 text-[11.5px] font-medium text-[var(--warning)]">
            <div className="mb-1 flex items-center gap-1.5 font-bold">
              <KeyRound size={13} /> {t("pushTest.missingServerKey", "ຂາດ server key ສຳລັບສົ່ງ FCM")}
            </div>
            {t("pushTest.setupHintPre", "ໃຫ້ເອົາ Firebase service account JSON ຂອງ project")} <b>saleproject-36fc8</b>{" "}
            {t("pushTest.setupHintMid", "ມາວາງເປັນ")}
            <b> BOQ2026/firebase-service-account.json</b> {t("pushTest.setupHintOr", "ຫຼືຕັ້ງ")} <b>FIREBASE_SERVICE_ACCOUNT</b>{" "}
            {t("pushTest.setupHintEnv", "ໃນ `.env`, ແລ້ວ restart server.")}
          </div>
        )}
      </Card>

      <Card className="mb-4 p-4">
        <SectionHeader icon={<Send size={15} />} title={t("pushTest.sendTestTitle", "ສົ່ງທົດສອບໄປແອັບ")} tone="brand" />
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("pushTest.codePlaceholder", "employee_code (ເຊັ່ນ 21012)")}
            className={`${inputCls} flex-1`}
          />
          <Btn variant="ink" onClick={() => sendTest(code.trim())} disabled={!code.trim() || sending || !status?.configured}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {t("pushTest.send", "ສົ່ງ")}
          </Btn>
        </div>
        {result && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${
              result.ok ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"
            }`}
          >
            {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {result.message}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionHeader
          icon={<Bell size={15} />}
          title={`${t("pushTest.registeredDevices", "Device ທີ່ລົງທະບຽນ")} (${status?.devices?.length ?? 0})`}
          tone="brand"
        />
        {!status?.devices?.length ? (
          <p className="py-4 text-center text-[12px] text-[var(--text-mute)]">
            {t("pushTest.noDevices", "ຍັງບໍ່ມີ device token — ໃຫ້ຊ່າງ login ໃນແອັບກ່ອນ")}
          </p>
        ) : (
          <div className="space-y-2">
            {status.devices.map((d) => (
              <div key={d.employee_code} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--info-soft)] bg-[var(--info-soft)] text-[var(--info)]">
                  <Bell size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-[var(--text)]">{d.name}</div>
                  <div className="text-[11px] text-[var(--text-mute)]">
                    {d.employee_code} · {d.tokens} device · {d.platforms}
                  </div>
                </div>
                <Btn variant="outline" onClick={() => sendTest(d.employee_code)} disabled={sending || !status.configured}>
                  <BellRing size={13} /> {t("pushTest.sendTest", "ສົ່ງທົດສອບ")}
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
