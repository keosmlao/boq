"use client";

/**
 * v2 (rebuild) login — the entry point of the new system.
 * Reuses the existing read-only `login` server action; on success the user is
 * stored client-side and routed to the workspace.
 */
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2, Eye, EyeOff, User, Lock, FolderKanban, ListChecks, Wrench, ShieldCheck, Smartphone } from "lucide-react";
import { login } from "@/_actions/auth";
import { useT } from "@/_lib/i18n";
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
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* ── Left brand panel (lg only) ── */}
      <div className="hidden">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[var(--brand-soft)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-[var(--brand-tint)] blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "28px 28px" }}
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-[var(--shadow-lg)]">
            <FolderKanban size={24} strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="text-[17px] font-black tracking-tight text-[var(--text)]">ODG Projects</div>
            <div className="text-[9px] font-black uppercase tracking-[0.28em] text-[var(--brand)]">Sales &amp; Installation</div>
          </div>
        </div>

        <div className="relative">
          <h2 className="font-display text-[34px] font-black leading-tight tracking-tight text-[var(--text)]">
            {t("login.hero.line1", "ລະບົບຂາຍ ແລະ")}<br />{t("login.hero.line2", "ຕິດຕັ້ງໂຄງການ")}
          </h2>
          <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-[var(--text-soft)]">
            {t("login.hero.desc", "ບໍລິຫານໂຄງການ ສັນຍາ BOQ ໃບງານ ສາງ ແລະ ທີມຊ່າງ ໃນບ່ອນດຽວ — ໄວ ຊັດເຈນ ກວດສອບໄດ້.")}
          </p>

          <div className="mt-8 space-y-3.5">
            {FEATURES.map((f) => (
              <div key={f.titleKey} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                  {f.icon}
                </span>
                <div>
                  <div className="text-[13px] font-bold text-[var(--text)]">{t(f.titleKey, f.titleLo)}</div>
                  <div className="text-[11.5px] text-[var(--text-soft)]">{t(f.descKey, f.descLo)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-mute)]">
          <ShieldCheck size={13} /> {t("login.accessNote", "ການເຂົ້າເຖິງຖືກກຳນົດໂດຍຜູ້ດູແລລະບົບ")}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex w-full flex-col items-center justify-center bg-[var(--bg)] px-5 py-10">
        <div className="w-full max-w-[400px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)] sm:p-8">
          {/* compact brand for small screens */}
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
              <FolderKanban size={26} strokeWidth={2.5} />
            </span>
            <h1 className="text-lg font-black tracking-tight text-[var(--text)]">ODG Projects</h1>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand)]">Sales &amp; Installation</p>
          </div>

          <div className="mb-6">
            <h2 className="text-[22px] font-black tracking-tight text-[var(--text)]">{t("login.welcome", "ຍິນດີຕ້ອນຮັບ")}</h2>
            <p className="mt-1 text-[13px] font-medium text-[var(--text-mute)]">{t("login.subtitle", "ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອສືບຕໍ່")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--danger)]">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[var(--text-soft)]">{t("login.username", "ຊື່ຜູ້ໃຊ້ / ລະຫັດພະນັກງານ")}</label>
              <div className="relative">
                <User size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-mute)]" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 pl-11 pr-3.5 text-[14px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-mute)] hover:border-[var(--border-strong)] focus:border-[var(--brand)] focus:ring-3 focus:ring-[var(--brand-ring)]"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[var(--text-soft)]">{t("login.password", "ລະຫັດຜ່ານ")}</label>
              <div className="relative">
                <Lock size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-mute)]" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 pl-11 pr-11 text-[14px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-mute)] hover:border-[var(--border-strong)] focus:border-[var(--brand)] focus:ring-3 focus:ring-[var(--brand-ring)]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-mute)] transition hover:text-[var(--text)]"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--go)] py-3.5 text-[14.5px] font-bold text-white shadow-[var(--shadow-xs)] transition-all duration-150 hover:bg-[var(--go-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {loading ? t("login.submitting", "ກຳລັງເຂົ້າ...") : t("login.submit", "ເຂົ້າສູ່ລະບົບ")}
            </button>
          </form>

          <a
            href="/download"
            className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 text-[13px] font-bold text-[var(--text-soft)] transition hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand-strong)]"
          >
            <Smartphone size={16} /> {t("login.downloadApp", "ດາວໂຫຼດແອັບຊ່າງ (Android)")}
          </a>

          <p className="mt-6 text-center text-[11px] font-medium text-[var(--text-mute)]">
            © {new Date().getFullYear()} ODG Projects · {t("login.rights", "ສະຫງວນລິຂະສິດ")}
          </p>
        </div>
      </div>
    </div>
  );
}
