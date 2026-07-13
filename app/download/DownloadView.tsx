"use client";

/**
 * Presentational body of the /download page. Split out of page.tsx so that page
 * can stay a server component (it exports `metadata` and stats the APK on disk)
 * while the copy still goes through the client-side i18n layer.
 */
import Link from "next/link";
import { Smartphone, Download, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useT } from "@/_lib/i18n";

const STEPS: { key: string; lo: string }[] = [
  { key: "download.step1", lo: "ກົດປຸ່ມ “ດາວໂຫຼດ APK” ດ້ານລຸ່ມ" },
  { key: "download.step2", lo: "ເປີດໄຟລ໌ທີ່ດາວໂຫຼດແລ້ວ (saang-app.apk)" },
  { key: "download.step3", lo: "ຖ້າມືຖືຖາມ ໃຫ້ອະນຸຍາດ “ຕິດຕັ້ງຈາກແຫຼ່ງທີ່ບໍ່ຮູ້ຈັກ”" },
  { key: "download.step4", lo: "ກົດ “ຕິດຕັ້ງ” ແລ້ວເປີດແອັບ ເພື່ອເຂົ້າສູ່ລະບົບ" },
];

export default function DownloadView({
  version,
  apkPath,
  sizeLabel,
}: {
  version: string;
  apkPath: string;
  sizeLabel: string | null;
}) {
  const t = useT();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* decorative glow */}
      <div className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-[var(--brand-soft)] blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -right-16 h-96 w-96 rounded-full bg-[var(--brand-tint)] blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center px-5 py-12">
        {/* app badge */}
        <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--brand)] text-white shadow-[var(--shadow-lg)]">
          <Smartphone size={38} strokeWidth={2.2} />
        </span>

        <h1 className="text-center font-display text-[26px] font-black tracking-tight text-[var(--text)]">
          {t("download.title", "ແອັບຊ່າງ ODG")}
        </h1>
        <p className="mt-1.5 text-center text-[13px] font-medium text-[var(--text-soft)]">
          {t("download.subtitle", "ສຳລັບຊ່າງຕິດຕັ້ງ — ຮັບໃບງານ ເຊັກອິນ ແລະ ຖ່າຍຮູບໜ້າວຽກໄດ້ຈາກມືຖື")}
        </p>

        <div className="mt-4 flex items-center gap-2 text-[11.5px] font-semibold text-[var(--text-soft)]">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1">
            Android · {t("download.version", "ເວີຊັນ")} {version}
          </span>
          {sizeLabel && <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1">{sizeLabel}</span>}
        </div>

        {/* download card */}
        <div className="mt-8 w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)] shadow-[var(--shadow-lg)]">
          <a
            href={apkPath}
            download
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--go)] py-4 text-[15px] font-bold text-white shadow-[var(--shadow-xs)] transition-all hover:bg-[var(--go-hover)] active:scale-[0.99]"
          >
            <Download size={20} />
            {t("download.cta", "ດາວໂຫຼດ APK")}
          </a>

          <div className="mt-6">
            <div className="mb-3 text-[12.5px] font-bold text-[var(--text-mute)]">{t("download.howTo", "ວິທີຕິດຕັ້ງ")}</div>
            <ol className="space-y-2.5">
              {STEPS.map((step, i) => (
                <li key={step.key} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--text-soft)]">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-black text-[var(--brand-strong)]">
                    {i + 1}
                  </span>
                  {t(step.key, step.lo)}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-3.5 py-2.5 text-[12px] font-medium leading-relaxed text-[var(--warning)]">
            <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
            {t("download.androidOnly", "ແອັບນີ້ສຳລັບ Android ເທົ່ານັ້ນ. ສຳລັບ iPhone ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ.")}
          </div>
        </div>

        <Link href="/login" className="mt-7 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-soft)] transition hover:text-[var(--brand-strong)]">
          <ArrowLeft size={14} /> {t("download.backToLogin", "ກັບໄປໜ້າເຂົ້າສູ່ລະບົບ")}
        </Link>

        <div className="mt-6 flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-mute)]">
          <ShieldCheck size={13} /> © {new Date().getFullYear()} ODG Projects
        </div>
      </div>
    </div>
  );
}
