"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight, CheckCircle2, Command,
  Layout, Users, Wrench, Shield,
  BarChart3, Lock, User as UserIcon
} from "lucide-react";
import { login as loginAction } from "@/_actions/auth";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function Login() {
  const router = useRouter();
  
  // Logic States
  const [view, setView] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempUserData, setTempUserData] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);

  // --- Logic Same as before ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginAction({ username, password });
      if (!res.success) {
        setError(res.message || "ເຂົ້າລະບົບບໍ່ສຳເລັດ");
        setLoading(false);
        return;
      }
      const roleData = res.role;
      
      let userRoles = [];
      if (typeof roleData === 'string' && roleData.includes(',')) {
        userRoles = roleData.split(',').map(r => r.trim()).filter(r => r);
      } else if (Array.isArray(roleData)) {
        userRoles = roleData;
      } else {
        userRoles = [roleData];
      }

      setTempUserData({
        username: res.username,
        name_1: res.name_1,
        allRoles: userRoles
      });

      setAvailableRoles(userRoles);
      // Default to the first role
      finalizeLogin(userRoles[0], {
        username: res.username,
        name_1: res.name_1,
        allRoles: userRoles
      });
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err?.message || "ການເຊື່ອມຕໍ່ມີບັນຫາ ກະລຸນາລອງໃໝ່");
      setLoading(false);
    }
  };

  const finalizeLogin = (selectedRole, userData = tempUserData) => {
    localStorage.setItem("user", JSON.stringify({ ...userData, role: selectedRole }));
    document.cookie = "odg-auth=1; path=/; max-age=" + (60*60*24*7);
    switch (selectedRole) {
      case "sale_admin": case "sale_manager": router.push("/sale-admin/list-project"); break;
      case "service_admin": case "service_manager": router.push("/service-admin/list-project"); break;
      case "head_technician": router.push("/head-tech/home"); break;
      case "account_admin": router.push("/acc"); break;
      default: router.push("/unauthorized");
    }
  };

  // Role Display Config
  const getRoleStyle = (role) => {
    switch(role) {
      case 'sale_manager': return { label: 'ຜູ້ຈັດການຂາຍ', icon: BarChart3, desc: 'ອະນຸມັດ & ຕິດຕາມການຂາຍ', bg: 'bg-[var(--theme-primary)]' };
      case 'service_manager': return { label: 'ຜູ້ຈັດການບໍລິການ', icon: Users, desc: 'ຄຸ້ມຄອງທີມງານໜ້າງານ', bg: 'bg-emerald-600' };
      case 'head_technician': return { label: 'ຫົວໜ້າຊ່າງ', icon: Wrench, desc: 'ນຳທີມຊ່າງ', bg: 'bg-orange-600' };
      case 'account_admin': return { label: 'ບັນຊີ', icon: Shield, desc: 'ກວດສອບການເງິນ', bg: 'bg-purple-600' };
      default: return { label: role.replace('_', ' '), icon: Layout, desc: 'ເຂົ້າເຖິງການດຳເນີນງານ', bg: 'bg-zinc-700' };
    }
  };

  return (
    <div className="min-h-screen w-full theme-shell-bg text-[var(--theme-text)] font-lao">
      <div className="relative grid min-h-screen lg:grid-cols-[minmax(420px,0.9fr)_1.1fr]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.72),transparent_58%)]"></div>

        {/* Left: Auth */}
        <div className="relative z-10 flex items-center justify-center px-5 py-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3">
              <div className="theme-btn-primary flex h-10 w-10 items-center justify-center rounded-md text-white">
                <Command size={18} />
              </div>
              <div>
                <div className="theme-kicker">ODG</div>
              </div>
            </div>

            <div className="theme-page-surface rounded-lg p-5 shadow-[0_24px_60px_-42px_rgba(23,33,43,0.55)] md:p-7">
              {view === "login" ? (
                <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="mb-6">
                    <div className="theme-kicker">Sign In</div>
                    <h1 className="mt-2 text-2xl font-bold theme-heading md:text-3xl">
                      ເຂົ້າລະບົບ ODG
                    </h1>
                    <p className="theme-copy mt-1 text-sm">
                      ຈັດການໂຄງການ, BOQ, ໃບຂໍເບີກ ແລະ ງານຕິດຕັ້ງໃນ workspace ດຽວ.
                    </p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--theme-text-soft)]">ຊື່ຜູ້ໃຊ້</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-3 text-[var(--theme-text-soft)]" size={18} />
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="theme-input w-full rounded-md py-3 pl-10 pr-4 text-sm transition-all"
                          placeholder="ປ້ອນຊື່ຜູ້ໃຊ້"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--theme-text-soft)]">ລະຫັດຜ່ານ</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 text-[var(--theme-text-soft)]" size={18} />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="theme-input w-full rounded-md py-3 pl-10 pr-4 text-sm transition-all"
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        <Shield size={14} /> {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="theme-btn-primary flex w-full items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold text-white transition-all disabled:opacity-70"
                    >
                      {loading ? "ກຳລັງກວດສອບ..." : "ເຂົ້າລະບົບ"}
                      {!loading && <ArrowRight size={16} />}
                    </button>
                  </form>

                  <div className="mt-6 border-t border-[var(--theme-border)] pt-4 text-[11px] text-[var(--theme-text-soft)]">
                    ເຂົ້າລະບົບປອດໄພ ແຍກສິດຕາມບົດບາດ ແລະ ຮອງຮັບຫຼາຍຝ່າຍ.
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="mb-5">
                    <button
                      onClick={() => setView("login")}
                      className="mb-3 flex items-center gap-1 text-xs text-[var(--theme-text-soft)] transition-colors hover:text-[var(--theme-text)]"
                    >
                      ← ກັບໄປໜ້າເຂົ້າລະບົບ
                    </button>
                    <h1 className="text-2xl font-bold theme-heading">ເລືອກລະດັບການເຂົ້າເຖິງ</h1>
                    <p className="theme-copy text-sm">
                      ບັນຊີນີ້ມີຫຼາຍບົດບາດ ກະລຸນາເລືອກ 1 ບົດບາດ.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {availableRoles.map((role) => {
                      const style = getRoleStyle(role);
                      const Icon = style.icon;
                      return (
                        <button
                          key={role}
                          onClick={() => finalizeLogin(role)}
                          className="theme-card theme-card-hover group flex w-full items-center gap-4 rounded-lg p-4 text-left"
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-md ${style.bg} text-white shadow-sm`}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-800 group-hover:text-[var(--theme-primary)]">
                              {style.label}
                            </h3>
                            <p className="text-xs text-[var(--theme-text-soft)]">{style.desc}</p>
                          </div>
                          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--theme-border)] transition-all group-hover:border-[var(--theme-primary)] group-hover:bg-[var(--theme-primary)]">
                            <ArrowRight size={12} className="text-transparent group-hover:text-white" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 text-[11px] text-[var(--theme-text-soft)]">
              &copy; 2026 ODG ລະບົບຈັດການໂຄງການ.
            </div>
          </div>
        </div>

        {/* Right: Brand */}
        <div className="relative hidden overflow-hidden lg:block">
          <img
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000"
            alt="Office"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,33,43,0.72),rgba(15,118,110,0.58))]"></div>

          <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
            <div className="flex items-center gap-3">
              <div className="h-1 w-10 rounded-full bg-[var(--theme-accent)]"></div>
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
                Project Operations Suite
              </span>
            </div>

            <div className="max-w-xl space-y-6">
              <h2 className="text-4xl font-bold leading-tight">
                One workspace for sales, service, stock and finance.
              </h2>
              <p className="text-base leading-relaxed text-white/82">
                ຮູບແບບໃໝ່ເນັ້ນການອ່ານຂໍ້ມູນ, ການຕິດຕາມສະຖານະ ແລະ ການເຮັດວຽກປະຈຳວັນຂອງທີມງານ.
              </p>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "ຄວາມຊັດເຈນ", value: "1 Flow" },
                  { label: "ບົດບາດ", value: "6 Teams" },
                  { label: "ໂຄງການ", value: "Live" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-white/16 bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/70">{stat.label}</div>
                    <div className="text-xl font-bold">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  "ຂັ້ນຕອນຊັດເຈນ",
                  "ສີສັນເບົາຕາ",
                  "ກວດສອບງ່າຍ",
                ].map((pill) => (
                  <span
                    key={pill}
                    className="rounded-md border border-white/14 bg-white/12 px-3 py-1.5 text-xs text-white/86"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#d4e4f6]">
              <CheckCircle2 size={14} className="text-white" />
              ບໍລິຫານໂດຍ ODG Technology
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Login as default };
