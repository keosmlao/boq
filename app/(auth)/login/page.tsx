"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Layout,
  Loader2,
  Lock,
  Shield,
  User as UserIcon,
  Users,
  Wrench,
} from "lucide-react";
import { login as loginAction } from "@/_actions/auth";
import { ThemeToggle } from "@/_components/theme/ThemeToggle";

type Role =
  | "sale_admin"
  | "sale_manager"
  | "service_admin"
  | "service_manager"
  | "head_technician"
  | "account_admin"
  | string;

type UserData = {
  username: string;
  name_1: string;
  allRoles: Role[];
};

function Login() {
  const router = useRouter();

  const [view, setView] = useState<"login" | "roles">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempUserData, setTempUserData] = useState<UserData | null>(null);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginAction({ username, password });
      if (!res.success) {
        setError((res as { message?: string }).message || "ເຂົ້າລະບົບບໍ່ສຳເລັດ");
        setLoading(false);
        return;
      }
      const roleData = res.role;

      let userRoles: Role[] = [];
      if (typeof roleData === "string" && roleData.includes(",")) {
        userRoles = roleData.split(",").map((r) => r.trim()).filter(Boolean);
      } else if (Array.isArray(roleData)) {
        userRoles = roleData;
      } else if (roleData) {
        userRoles = [roleData as Role];
      }

      const data: UserData = {
        username: res.username as string,
        name_1: res.name_1 as string,
        allRoles: userRoles,
      };
      setTempUserData(data);
      setAvailableRoles(userRoles);

      if (userRoles.length > 1) {
        setView("roles");
        setLoading(false);
      } else {
        finalizeLogin(userRoles[0], data);
      }
    } catch (err: unknown) {
      console.error("Login error:", err);
      const msg = err instanceof Error ? err.message : "ການເຊື່ອມຕໍ່ມີບັນຫາ ກະລຸນາລອງໃໝ່";
      setError(msg);
      setLoading(false);
    }
  };

  const finalizeLogin = (selectedRole: Role, userData: UserData | null = tempUserData) => {
    if (!userData) return;
    localStorage.setItem("user", JSON.stringify({ ...userData, role: selectedRole }));
    switch (selectedRole) {
      case "sale_admin":
      case "sale_manager":
        router.push("/sale-admin/list-project");
        break;
      case "service_admin":
      case "service_manager":
        router.push("/service-admin/list-project");
        break;
      case "head_technician":
        router.push("/head-tech/home");
        break;
      case "account_admin":
        router.push("/acc");
        break;
      default:
        router.push("/unauthorized");
    }
  };

  const getRoleMeta = (role: Role) => {
    switch (role) {
      case "sale_admin":
        return { label: "ແອັດມິນຂາຍ", icon: BarChart3, desc: "ຄຸ້ມຄອງໂຄງການຂາຍ ແລະ ໃບສະເໜີລາຄາ" };
      case "sale_manager":
        return { label: "ຜູ້ຈັດການຂາຍ", icon: BarChart3, desc: "ອະນຸມັດ ແລະ ຕິດຕາມການຂາຍ" };
      case "service_admin":
        return { label: "ແອັດມິນບໍລິການ", icon: Wrench, desc: "ຈັດການ BOQ, ໃບສັ່ງວຽກ, ສາງ" };
      case "service_manager":
        return { label: "ຜູ້ຈັດການບໍລິການ", icon: Users, desc: "ຄຸ້ມຄອງທີມງານໜ້າງານ" };
      case "head_technician":
        return { label: "ຫົວໜ້າຊ່າງ", icon: Wrench, desc: "ນຳທີມຊ່າງ ແລະ ບັນທຶກວຽກໜ້າງານ" };
      case "account_admin":
        return { label: "ບັນຊີ", icon: Shield, desc: "ກວດສອບການເງິນ ແລະ ງວດຊຳລະ" };
      default:
        return { label: role.replace(/_/g, " "), icon: Layout, desc: "ເຂົ້າເຖິງການດຳເນີນງານ" };
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4 py-10">
      {/* Theme toggle pinned top-right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px]">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--text)] text-[var(--text-inverse)]">
            <img
              src="/ODG.png"
              alt="ODG"
              className="h-6 w-6 object-contain invert dark:invert-0"
            />
          </div>
          <div>
            <div className="text-[18px] font-semibold tracking-tight text-[var(--text)]">
              ODG Project Management
            </div>
            <div className="mt-1 text-[12.5px] text-[var(--text-soft)]">
              Sales · Service · Inventory · Finance
            </div>
          </div>
        </div>

        {view === "login" ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
            <div className="mb-5">
              <h1 className="text-[16px] font-semibold text-[var(--text)]">ເຂົ້າລະບົບ</h1>
              <p className="mt-1 text-[12.5px] text-[var(--text-soft)]">
                ໃສ່ບັນຊີຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານຂອງທ່ານ
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[var(--text)]">
                  ຊື່ຜູ້ໃຊ້
                </label>
                <div className="relative">
                  <UserIcon
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-mute)]"
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ປ້ອນຊື່ຜູ້ໃຊ້"
                    autoComplete="username"
                    required
                    className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-[13.5px] text-[var(--text)] placeholder:text-[var(--text-mute)] transition-colors hover:border-[var(--border-strong)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[var(--text)]">
                  ລະຫັດຜ່ານ
                </label>
                <div className="relative">
                  <Lock
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-mute)]"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-[13.5px] text-[var(--text)] placeholder:text-[var(--text-mute)] transition-colors hover:border-[var(--border-strong)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-2.5 text-[12px] text-[var(--danger)] animate-shake">
                  <Shield size={13} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--brand)] text-[13.5px] font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>ກຳລັງກວດສອບ...</span>
                  </>
                ) : (
                  <>
                    <span>ເຂົ້າລະບົບ</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 border-t border-[var(--border-soft)] pt-4 text-center">
              <p className="text-[11.5px] text-[var(--text-mute)]">
                ມີບັນຫາໃນການເຂົ້າໃຊ້? ກະລຸນາຕິດຕໍ່ຝ່າຍ IT
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
            <div className="mb-4">
              <button
                onClick={() => {
                  setView("login");
                  setError("");
                }}
                className="mb-2 text-[11.5px] font-medium text-[var(--text-soft)] hover:text-[var(--text)]"
              >
                ← ກັບໄປ
              </button>
              <h1 className="text-[16px] font-semibold text-[var(--text)]">
                ເລືອກບົດບາດ
              </h1>
              <p className="mt-1 text-[12.5px] text-[var(--text-soft)]">
                ບັນຊີຂອງທ່ານມີຫຼາຍບົດບາດ ກະລຸນາເລືອກ
              </p>
            </div>

            <div className="theme-scrollbar max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {availableRoles.map((role) => {
                const meta = getRoleMeta(role);
                const Icon = meta.icon;
                return (
                  <button
                    key={role}
                    onClick={() => finalizeLogin(role)}
                    className="group flex w-full items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-colors hover:border-[var(--text)] hover:bg-[var(--bg-subtle)]"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] text-[var(--text-soft)] group-hover:bg-[var(--text)] group-hover:text-[var(--text-inverse)] transition-colors">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-[var(--text)]">
                        {meta.label}
                      </div>
                      <div className="truncate text-[11.5px] text-[var(--text-mute)]">
                        {meta.desc}
                      </div>
                    </div>
                    <ArrowRight
                      size={14}
                      className="flex-shrink-0 text-[var(--text-mute)] group-hover:text-[var(--text)]"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-[11px] text-[var(--text-mute)]">
          &copy; {new Date().getFullYear()} ODG Project Management
        </div>
      </div>
    </div>
  );
}

export { Login as default };
