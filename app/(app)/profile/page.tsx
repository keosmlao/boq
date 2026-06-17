"use client";

/**
 * Profile & settings — shows the signed-in user, their role and the per-module
 * permissions carried in the session, plus a logout action. Read-only: account
 * management lives under /users (managers only).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, LogOut, Check, Minus, Settings } from "lucide-react";
import { Page, PageHeader, Card, SectionTitle } from "../_components/ui";
import { getV2User, clearV2User, type V2User } from "../../_lib/session";
import { MODULES, ROLE_LABELS, can, isManager, type Action } from "@/_lib/permissions";
import { useT } from "@/_lib/i18n";

export default function ProfilePage() {
  const router = useRouter();
  const t = useT();

  const ACTIONS: { key: Action; label: string }[] = [
    { key: "view", label: t("common.view", "ເບິ່ງ") },
    { key: "create", label: t("common.create", "ສ້າງ") },
    { key: "edit", label: t("common.edit", "ແກ້ໄຂ") },
    { key: "delete", label: t("common.delete", "ລຶບ") },
    { key: "approve", label: t("common.approve", "ອະນຸມັດ") },
  ];
  const [user, setUser] = useState<V2User | null>(null);

  useEffect(() => {
    setUser(getV2User());
  }, []);

  const doLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    clearV2User();
    router.replace("/login");
  };

  const accessUser = { role: user?.role, permissions: user?.permissions };
  const roleLabel = user?.role ? ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role : "—";
  const initial = (user?.name || "?").replace(/[^\p{L}\p{N}]/u, "").charAt(0).toUpperCase() || "?";

  return (
    <Page max="max-w-[900px]">
      <PageHeader title={t("profile.title", "ໂປຣໄຟລ໌ & ການຕັ້ງຄ່າ")} subtitle={t("profile.subtitle", "ຂໍ້ມູນບັນຊີ ແລະ ສິດການນຳໃຊ້ຂອງທ່ານ")} />

      {/* Identity card */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl premium-gradient text-lg font-black text-white shadow-md shadow-blue-600/25">
              {initial}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-900">{user?.name || "—"}</h2>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
                <User size={13} /> {user?.username || "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-blue-700">
              <ShieldCheck size={13} /> {roleLabel}
            </span>
            {user && isManager(accessUser) && (
              <span className="text-[11px] font-bold text-slate-400">{t("profile.managerAccess", "ສິດຜູ້ຄຸ້ມຄອງ")}</span>
            )}
          </div>
        </div>
      </Card>

      {/* Permission matrix */}
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 pt-5">
          <SectionTitle label={t("profile.permsByModule", "ສິດການນຳໃຊ້ ຕາມໂມດູນ")} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t("profile.module", "ໂມດູນ")}
                </th>
                {ACTIONS.map((a) => (
                  <th key={a.key} className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.key} className="transition-colors hover:bg-blue-50/40">
                  <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-5 py-2.5 font-bold text-slate-700">{m.label}</td>
                  {ACTIONS.map((a) => {
                    const applicable = (m.actions as string[]).includes(a.key);
                    const allowed = applicable && user ? can(accessUser, m.key, a.key) : false;
                    return (
                      <td key={a.key} className="border-b border-slate-100 px-3 py-2.5 text-center">
                        {!applicable ? (
                          <Minus size={14} className="mx-auto text-slate-200" />
                        ) : allowed ? (
                          <Check size={15} className="mx-auto text-emerald-500" strokeWidth={3} />
                        ) : (
                          <Minus size={14} className="mx-auto text-rose-200" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Settings / actions */}
      <Card className="p-5">
        <SectionTitle label={t("profile.settings", "ການຕັ້ງຄ່າ")} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-slate-500">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Settings size={16} />
            </span>
            <span className="text-[12.5px] font-semibold">{t("profile.logoutDevice", "ອອກຈາກລະບົບໃນອຸປະກອນນີ້")}</span>
          </div>
          <button
            onClick={doLogout}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm shadow-rose-600/25 transition-all duration-150 hover:bg-rose-700 active:scale-[0.98]"
          >
            <LogOut size={15} /> {t("profile.logout", "ອອກຈາກລະບົບ")}
          </button>
        </div>
      </Card>
    </Page>
  );
}
