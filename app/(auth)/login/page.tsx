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
import { setV2User } from "../../_lib/session";

const FEATURES = [
  { icon: <FolderKanban size={16} />, title: "ໂຄງການ & ສັນຍາ", desc: "ຈັດການໂຄງການ ໃບສະເໜີ ແລະ ສັນຍາ ຄົບວົງຈອນ" },
  { icon: <ListChecks size={16} />, title: "BOQ & ການຂໍເບີກ", desc: "ຄຸມງົບປະມານ ວັດສະດຸ ແລະ ການເບີກຈ່າຍ" },
  { icon: <Wrench size={16} />, title: "ໃບງານ & ຕິດຕາມຊ່າງ", desc: "ມອບໝາຍ ຕິດຕາມໜ້າວຽກ ແລະ ຕຳແໜ່ງຊ່າງແບບສົດ" },
];

export default function V2LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ");
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
        setError(res?.message || "ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ");
      }
    } catch {
      setError("ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ── Left brand panel (lg only) ── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-12 text-white lg:flex">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "28px 28px" }}
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur">
            <FolderKanban size={24} strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="text-[17px] font-black tracking-tight">ODG Projects</div>
            <div className="text-[9px] font-black uppercase tracking-[0.28em] text-blue-200">Sales & Installation</div>
          </div>
        </div>

        <div className="relative">
          <h2 className="font-display text-[34px] font-black leading-tight tracking-tight">
            ລະບົບຂາຍ ແລະ<br />ຕິດຕັ້ງໂຄງການ
          </h2>
          <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-blue-100/90">
            ບໍລິຫານໂຄງການ ສັນຍາ BOQ ໃບງານ ສາງ ແລະ ທີມຊ່າງ ໃນບ່ອນດຽວ — ໄວ ຊັດເຈນ ກວດສອບໄດ້.
          </p>

          <div className="mt-8 space-y-3.5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
                  {f.icon}
                </span>
                <div>
                  <div className="text-[13px] font-bold">{f.title}</div>
                  <div className="text-[11.5px] text-blue-100/80">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-1.5 text-[11px] font-semibold text-blue-100/70">
          <ShieldCheck size={13} /> ການເຂົ້າເຖິງຖືກກຳນົດໂດຍຜູ້ດູແລລະບົບ
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex w-full flex-col items-center justify-center px-5 py-10 lg:w-1/2">
        <div className="w-full max-w-[380px]">
          {/* compact brand for small screens */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30">
              <FolderKanban size={26} strokeWidth={2.5} />
            </span>
            <h1 className="text-lg font-black tracking-tight text-slate-900">ODG Projects</h1>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500">Sales & Installation</p>
          </div>

          <div className="mb-6">
            <h2 className="text-[22px] font-black tracking-tight text-slate-900">ຍິນດີຕ້ອນຮັບ 👋</h2>
            <p className="mt-1 text-[13px] font-medium text-slate-500">ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອສືບຕໍ່</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-slate-600">ຊື່ຜູ້ໃຊ້ / ລະຫັດພະນັກງານ</label>
              <div className="relative">
                <User size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-3.5 text-[14px] text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/12"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-slate-600">ລະຫັດຜ່ານ</label>
              <div className="relative">
                <Lock size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-[14px] text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-[14.5px] font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {loading ? "ກຳລັງເຂົ້າ..." : "ເຂົ້າສູ່ລະບົບ"}
            </button>
          </form>

          <a
            href="/download"
            className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-[13px] font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-600"
          >
            <Smartphone size={16} /> ດາວໂຫຼດແອັບຊ່າງ (Android)
          </a>

          <p className="mt-6 text-center text-[11px] font-medium text-slate-400">
            © {new Date().getFullYear()} ODG Projects · ສະຫງວນລິຂະສິດ
          </p>
        </div>
      </div>
    </div>
  );
}
