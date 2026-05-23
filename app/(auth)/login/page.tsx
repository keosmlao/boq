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
    <div className="min-h-screen w-full bg-[var(--theme-bg)] text-[var(--theme-text)] font-lao flex items-center justify-center relative overflow-hidden">
      {/* Decorative ambient glowing blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[rgba(79,70,229,0.08)] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[rgba(14,165,233,0.08)] blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl mx-auto my-4 px-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-[var(--radius-xl)] border border-[var(--theme-border)] shadow-[var(--theme-shadow-lg)] overflow-hidden grid lg:grid-cols-[1.1fr_0.9fr]">
          
          {/* Left Side: Brand Story & Design Showcase */}
          <div className="relative hidden lg:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca]">
            {/* Overlay grid lines for tech look */}
            <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute inset-0 bg-gradient-to-tr from-[rgba(14,165,233,0.15)] to-transparent pointer-events-none" />

            <div className="relative flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                <Command size={16} className="text-[var(--theme-accent)]" />
              </div>
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/90 font-sans">
                ODIEN GROUP
              </span>
            </div>

            <div className="relative max-w-lg space-y-8 my-auto">
              <div className="space-y-4">
                <span className="text-[var(--theme-accent)] text-xs font-bold uppercase tracking-[0.25em] font-sans block">
                  Project Operations Suite
                </span>
                <h2 className="text-4xl font-extrabold leading-tight font-sans">
                  One workspace for sales, service, stock & finance.
                </h2>
                <p className="text-sm leading-relaxed text-slate-300 font-light">
                  ລະບົບບໍລິຫານຈັດການໂຄງການຮູບແບບໃໝ່ ເນັ້ນຄວາມຊັດເຈນຂອງຂໍ້ມູນ, ການຕິດຕາມສະຖານະໜ້າງານ ແລະ ການເຮັດວຽກປະຈຳວັນຂອງທີມງານໃຫ້ວ່ອງໄວຂຶ້ນ.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4">
                {[
                  { label: "ການເຮັດວຽກ", value: "1 Flow" },
                  { label: "ທີມງານຫຼັກ", value: "6 Roles" },
                  { label: "ສະຖານະ", value: "Real-time" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-[var(--radius-md)] border border-white/10 bg-white/5 p-4 backdrop-blur-md hover:bg-white/10 transition-all duration-300">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-slate-300 font-sans">{stat.label}</div>
                    <div className="text-lg font-bold mt-1 text-white font-sans">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {["ການຕິດຕາມ BOQ", "ການຈັດການໃບເບີກ", "ລາຍງານຊ່າງໜ້າງານ"].map((tag) => (
                  <span key={tag} className="text-xs bg-white/10 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm text-slate-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative flex items-center gap-2 text-xs text-slate-300">
              <CheckCircle2 size={14} className="text-[var(--theme-success)]" />
              <span>Developed & Managed by ODG Technology</span>
            </div>
          </div>

          {/* Right Side: Auth Form */}
          <div className="flex items-center justify-center p-8 lg:p-12 bg-white">
            <div className="w-full max-w-md space-y-8">
              
              {/* Logo / Header for mobile */}
              <div className="flex lg:hidden items-center gap-3 justify-center mb-6">
                <div className="h-9 w-9 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center text-white">
                  <Command size={18} />
                </div>
                <span className="text-lg font-bold tracking-[0.15em] text-[var(--theme-primary)]">ODIEN GROUP</span>
              </div>

              {view === "login" ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
                  <div className="space-y-2 text-center lg:text-left">
                    <span className="text-[var(--theme-primary)] text-xs font-bold uppercase tracking-[0.2em] block font-sans">
                      SIGN IN TO SYSTEM
                    </span>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[var(--theme-text)]">
                      ເຂົ້າລະບົບ ODG
                    </h1>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      ກະລຸນາໃສ່ບັນຊີຜູ້ໃຊ້ເພື່ອເຂົ້າຈັດການລະບົບຂອງທ່ານ
                    </p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--theme-text-soft)]">
                        ຊື່ຜູ້ໃຊ້ (Username)
                      </label>
                      <div className="relative">
                        <UserIcon className="absolute left-3.5 top-3 text-[var(--theme-text-mute)]" size={16} />
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full bg-[var(--theme-bg)] border border-[var(--theme-border)] focus:border-[var(--theme-primary)] rounded-[var(--radius-sm)] py-3 pl-11 pr-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-soft)]/20"
                          placeholder="ປ້ອນຊື່ຜູ້ໃຊ້ຂອງທ່ານ"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--theme-text-soft)]">
                          ລະຫັດຜ່ານ (Password)
                        </label>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 text-[var(--theme-text-mute)]" size={16} />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-[var(--theme-bg)] border border-[var(--theme-border)] focus:border-[var(--theme-primary)] rounded-[var(--radius-sm)] py-3 pl-11 pr-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-soft)]/20"
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-red-200 bg-red-50/50 p-3 text-xs text-red-600 animate-shake">
                        <Shield size={14} className="flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-strong)] hover:from-[var(--theme-primary-strong)] hover:to-[var(--theme-primary)] text-white shadow-md hover:shadow-lg rounded-[var(--radius-sm)] py-3 text-sm font-semibold transition-all duration-300 disabled:opacity-75 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>ກຳລັງກວດສອບ...</span>
                        </>
                      ) : (
                        <>
                          <span>ເຂົ້າລະບົບ</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="pt-4 border-t border-[var(--theme-border)] text-center lg:text-left">
                    <p className="text-xs text-[var(--theme-text-mute)]">
                      ມີບັນຫາໃນການເຂົ້າໃຊ້ລະບົບ? ກະລຸນາຕິດຕໍ່ ຝ່າຍໄອທີ ຫຼື ຜູ້ດູແລລະບົບ.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-left-4 duration-500 space-y-6">
                  <div className="space-y-2">
                    <button
                      onClick={() => setView("login")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-primary-strong)] transition-colors"
                    >
                      ← ກັບໄປໜ້າເຂົ້າລະບົບ
                    </button>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[var(--theme-text)]">
                      ເລືອກລະດັບການເຂົ້າເຖິງ
                    </h1>
                    <p className="text-sm text-[var(--theme-text-soft)]">
                      ບັນຊີຂອງທ່ານມີຫຼາຍບົດບາດ ກະລຸນາເລືອກ 1 ບົດບາດເພື່ອເລີ່ມເຮັດວຽກ.
                    </p>
                  </div>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 theme-scrollbar">
                    {availableRoles.map((role) => {
                      const style = getRoleStyle(role);
                      const Icon = style.icon;
                      return (
                        <button
                          key={role}
                          onClick={() => finalizeLogin(role)}
                          className="w-full text-left flex items-center gap-4 p-4 rounded-[var(--radius-md)] border border-[var(--theme-border)] hover:border-[var(--theme-primary)] bg-white hover:bg-[var(--theme-primary-tint)] transition-all duration-300 group cursor-pointer"
                        >
                          <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] group-hover:bg-[var(--theme-primary)] group-hover:text-white transition-all duration-300`}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--theme-text)] group-hover:text-[var(--theme-primary-strong)]">
                              {style.label}
                            </h3>
                            <p className="text-xs text-[var(--theme-text-soft)] truncate mt-0.5">{style.desc}</p>
                          </div>
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--theme-border)] group-hover:border-[var(--theme-primary)] group-hover:bg-[var(--theme-primary)] text-[var(--theme-text-mute)] group-hover:text-white transition-all duration-300">
                            <ArrowRight size={12} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="text-center lg:text-left text-xs text-[var(--theme-text-mute)] pt-2">
                &copy; {new Date().getFullYear()} ODG Project Suite. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Login as default };
