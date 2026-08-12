"use client";

/**
 * Login — ODIEN SERVICE (ODS) layout: a dark brand field on the left carrying
 * the product story, the form alone on the right. Fields are 48px with the
 * label above and the icon inside the border, so the two columns read as one
 * page rather than a card floating on a canvas.
 */
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Eye, EyeOff, User, Lock, FolderKanban, ListChecks, Wrench, ShieldCheck, Smartphone } from "lucide-react";
import { login } from "@/_actions/auth";
import { useT } from "@/_lib/i18n";
import LanguageSwitcher from "../../(app)/_components/LanguageSwitcher";
import { setV2User } from "../../_lib/session";

const FEATURES = [
  {
    icon: <FolderKanban size={16} />,
    titleKey: "login.feature.projects.title",
    titleLo: "ໂຄງການ & ສັນຍາ",
    descKey: "login.feature.projects.desc",
    descLo: "ຈັດການໂຄງການ ໃບສະເໜີ ແລະ ສັນຍາ ຄົບວົງຈອນ",
  },
  {
    icon: <ListChecks size={16} />,
    titleKey: "login.feature.boq.title",
    titleLo: "BOQ & ການຂໍເບີກ",
    descKey: "login.feature.boq.desc",
    descLo: "ຄຸມງົບປະມານ ວັດສະດຸ ແລະ ການເບີກຈ່າຍ",
  },
  {
    icon: <Wrench size={16} />,
    titleKey: "login.feature.workOrders.title",
    titleLo: "ໃບງານ & ຕິດຕາມຊ່າງ",
    descKey: "login.feature.workOrders.desc",
    descLo: "ມອບໝາຍ ຕິດຕາມໜ້າວຽກ ແລະ ຕຳແໜ່ງຊ່າງແບບສົດ",
  },
];

/** Field shell — the border lives here, so icon + input light up together. */
const fieldCls =
  "flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 transition-all duration-150 hover:border-[var(--border-strong)] focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--brand-ring)]";
const inputCls =
  "h-12 w-full min-w-0 bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]";

export default function V2LoginPage() {
  const router = useRouter();
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError(t("login.error.missing", "ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ"));
      return;
    }
    setLoading(true);
    try {
      const res: any = await login({ username, password });
      if (res?.success) {
        setV2User({
          username: res.username,
          name: (res.name_1 as string) || res.username,
          role: res.role,
          permissions: res.permissions || {},
        });
        router.replace("/");
      } else {
        setError(res?.message || t("login.error.failed", "ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ"));
      }
    } catch {
      setError(t("login.error.unexpected", "ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[var(--bg)] lg:grid-cols-[1.1fr_0.9fr]">
      {/* ── Left: brand field (lg and up) — classic corporate navy ──────── */}
      <section
        className="relative hidden overflow-hidden p-14 text-white lg:flex lg:flex-col lg:justify-between"
        style={{ background: "var(--sidebar-bg)" }}
      >
        {/* Navy lit by its gradient partners — Sky Blue and Warm Yellow (guideline p.17). */}
        <div
          className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(75,199,239,0.30) 0%, rgba(75,199,239,0) 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,208,113,0.12) 0%, rgba(255,208,113,0) 70%)" }}
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
            <FolderKanban size={22} strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="text-[17px] font-black tracking-tight">ODG PROJECTS</div>
            <div className="text-[9.5px] font-black uppercase tracking-[0.28em] text-white/55">Sales &amp; Installation</div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="mb-4 text-[11px] font-black uppercase tracking-[0.28em] text-[var(--brand)]">
            {t("login.eyebrow", "Project management")}
          </p>
          <h1 className="font-display text-[42px] font-black leading-[1.15] tracking-tight">
            {t("login.hero.line1", "ລະບົບຂາຍ ແລະ")}
            <br />
            {t("login.hero.line2", "ຕິດຕັ້ງໂຄງການ")}
          </h1>
          <p className="mt-5 max-w-md text-[14px] leading-7 text-white/60">
            {t("login.hero.desc", "ບໍລິຫານໂຄງການ ສັນຍາ BOQ ໃບງານ ສາງ ແລະ ທີມຊ່າງ ໃນບ່ອນດຽວ — ໄວ ຊັດເຈນ ກວດສອບໄດ້.")}
          </p>

          <div className="mt-10 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.titleKey} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                  {f.icon}
                </span>
                <div>
                  <div className="text-[13px] font-bold text-white">{t(f.titleKey, f.titleLo)}</div>
                  <div className="text-[11.5px] text-white/50">{t(f.descKey, f.descLo)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative flex items-center gap-1.5 text-[11.5px] font-semibold text-white/40">
          <ShieldCheck size={13} /> {t("login.accessNote", "ການເຂົ້າເຖິງຖືກກຳນົດໂດຍຜູ້ດູແລລະບົບ")}
        </p>
      </section>

      {/* ── Right: the form ───────────────────────────────────────────────── */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--brand)] text-white lg:hidden">
              <FolderKanban size={22} strokeWidth={2.5} />
            </span>
            <b className="text-[15px] font-black tracking-tight text-[var(--text)] lg:hidden">ODG PROJECTS</b>
            <div className="ml-auto">
              <LanguageSwitcher />
            </div>
          </div>

          <p className="text-[13px] font-bold text-[var(--brand)]">{t("login.welcome", "ຍິນດີຕ້ອນຮັບ")}</p>
          <h2 className="mt-2 text-[30px] font-black leading-tight tracking-tight text-[var(--text)]">
            {t("login.title", "ເຂົ້າສູ່ລະບົບ")}
          </h2>
          <p className="mb-8 mt-3 text-[13.5px] text-[var(--text-mute)]">
            {t("login.subtitle", "ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອສືບຕໍ່")}
          </p>

          <form onSubmit={onSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-[12.5px] font-bold text-[var(--text-soft)]">
                {t("login.username", "ຊື່ຜູ້ໃຊ້ / ລະຫັດພະນັກງານ")}
              </span>
              <span className={fieldCls}>
                <User size={18} className="flex-shrink-0 text-[var(--text-mute)]" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  className={inputCls}
                  placeholder="username"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-[12.5px] font-bold text-[var(--text-soft)]">{t("login.password", "ລະຫັດຜ່ານ")}</span>
              <span className={fieldCls}>
                <Lock size={18} className="flex-shrink-0 text-[var(--text-mute)]" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputCls}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="flex-shrink-0 text-[var(--text-mute)] transition hover:text-[var(--text)]"
                  tabIndex={-1}
                  aria-label={t("login.togglePassword", "ສະແດງ/ເຊື່ອງລະຫັດຜ່ານ")}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-[var(--danger-soft)] px-4 py-3 text-[12.5px] font-semibold text-[var(--danger)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] text-[14.5px] font-bold text-white shadow-[var(--shadow-md)] transition-all duration-150 hover:bg-[var(--brand-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {loading ? t("login.submitting", "ກຳລັງເຂົ້າ...") : t("login.submit", "ເຂົ້າສູ່ລະບົບ")}
            </button>
          </form>

          <a
            href="/download"
            className="mt-5 flex h-12 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] font-bold text-[var(--text-soft)] transition hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand-strong)]"
          >
            <Smartphone size={16} /> {t("login.downloadApp", "ດາວໂຫຼດແອັບຊ່າງ (Android)")}
          </a>

          <p className="mt-10 text-[11.5px] font-medium text-[var(--text-mute)]">
            © {new Date().getFullYear()} ODIEN Group · {t("login.rights", "ສະຫງວນລິຂະສິດ")}
          </p>
        </div>
      </section>
    </main>
  );
}
