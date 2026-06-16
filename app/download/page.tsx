import type { Metadata } from "next";
import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { Smartphone, Download, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "ດາວໂຫຼດແອັບຊ່າງ",
  description: "ດາວໂຫຼດແອັບຊ່າງ ODG ສຳລັບ Android",
};

// App build metadata. Bump `VERSION` whenever a new APK is published so the
// page shows the right number; the file size is read from disk at request time.
const VERSION = "1.0.0";
const APK_PATH = "/downloads/saang-app.apk";

const STEPS = [
  "ກົດປຸ່ມ “ດາວໂຫຼດ APK” ດ້ານລຸ່ມ",
  "ເປີດໄຟລ໌ທີ່ດາວໂຫຼດແລ້ວ (saang-app.apk)",
  "ຖ້າມືຖືຖາມ ໃຫ້ອະນຸຍາດ “ຕິດຕັ້ງຈາກແຫຼ່ງທີ່ບໍ່ຮູ້ຈັກ”",
  "ກົດ “ຕິດຕັ້ງ” ແລ້ວເປີດແອັບ ເພື່ອເຂົ້າສູ່ລະບົບ",
];

async function getApkSizeLabel(): Promise<string | null> {
  try {
    const stat = await fs.stat(path.join(process.cwd(), "public", "downloads", "saang-app.apk"));
    const mb = stat.size / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  } catch {
    return null;
  }
}

export default async function DownloadPage() {
  const sizeLabel = await getApkSizeLabel();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white">
      {/* decorative glow */}
      <div className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -right-16 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "28px 28px" }}
      />

      <div className="relative mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center px-5 py-12">
        {/* app badge */}
        <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 shadow-xl backdrop-blur">
          <Smartphone size={38} strokeWidth={2.2} />
        </span>

        <h1 className="text-center font-display text-[26px] font-black tracking-tight">ແອັບຊ່າງ ODG</h1>
        <p className="mt-1.5 text-center text-[13px] font-medium text-blue-100/85">
          ສຳລັບຊ່າງຕິດຕັ້ງ — ຮັບໃບງານ ເຊັກອິນ ແລະ ຖ່າຍຮູບໜ້າວຽກໄດ້ຈາກມືຖື
        </p>

        <div className="mt-4 flex items-center gap-2 text-[11.5px] font-semibold text-blue-100/80">
          <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">Android · ເວີຊັນ {VERSION}</span>
          {sizeLabel && <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{sizeLabel}</span>}
        </div>

        {/* download card */}
        <div className="mt-8 w-full rounded-3xl bg-white p-6 text-slate-800 shadow-2xl shadow-blue-900/30">
          <a
            href={APK_PATH}
            download
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99]"
          >
            <Download size={20} />
            ດາວໂຫຼດ APK
          </a>

          <div className="mt-6">
            <div className="mb-3 text-[12.5px] font-bold text-slate-500">ວິທີຕິດຕັ້ງ</div>
            <ol className="space-y-2.5">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-black text-blue-600">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-medium leading-relaxed text-amber-800">
            <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
            ແອັບນີ້ສຳລັບ Android ເທົ່ານັ້ນ. ສຳລັບ iPhone ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ.
          </div>
        </div>

        <Link href="/login" className="mt-7 flex items-center gap-1.5 text-[12.5px] font-semibold text-blue-100/80 transition hover:text-white">
          <ArrowLeft size={14} /> ກັບໄປໜ້າເຂົ້າສູ່ລະບົບ
        </Link>

        <div className="mt-6 flex items-center gap-1.5 text-[11px] font-medium text-blue-100/60">
          <ShieldCheck size={13} /> © {new Date().getFullYear()} ODG Projects
        </div>
      </div>
    </div>
  );
}
