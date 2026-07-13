"use client";

/**
 * Profile & settings — shows the signed-in user, their role and the per-module
 * permissions carried in the session, plus a logout action. Read-only: account
 * management lives under /users (managers only).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, LogOut, Check, Minus, Settings } from "lucide-react";
import { Page, PageHeader, Card, Btn, Pill, SectionHeader, tblCls, thCls, tdCls, trHover } from "../_components/ui";
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
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-lg font-black text-white shadow-[var(--shadow-sm)]">
              {initial}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-[var(--text)]">{user?.name || "—"}</h2>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-mute)]">
                <User size={13} /> {user?.username || "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Pill tone="brand">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} /> {roleLabel}
              </span>
            </Pill>
            {user && isManager(accessUser) && (
              <span className="text-[11px] font-bold text-[var(--text-mute)]">{t("profile.managerAccess", "ສິດຜູ້ຄຸ້ມຄອງ")}</span>
            )}
          </div>
        </div>
      </Card>

      {/* Permission matrix */}
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-[var(--border-soft)] px-5 pt-5">
          <SectionHeader icon={<ShieldCheck size={15} />} title={t("profile.permsByModule", "ສິດການນຳໃຊ້ ຕາມໂມດູນ")} tone="brand" />
        </div>
        <div className="overflow-x-auto">
          <table className={tblCls}>
            <thead>
              <tr>
                <th className={`${thCls} sticky left-0`}>{t("profile.module", "ໂມດູນ")}</th>
                {ACTIONS.map((a) => (
                  <th key={a.key} className={`${thCls} text-center`}>
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.key} className={trHover}>
                  <td className={`${tdCls} sticky left-0 bg-[var(--surface)] font-bold text-[var(--text)]`}>{m.label}</td>
                  {ACTIONS.map((a) => {
                    const applicable = (m.actions as string[]).includes(a.key);
                    const allowed = applicable && user ? can(accessUser, m.key, a.key) : false;
                    return (
                      <td key={a.key} className={`${tdCls} text-center`}>
                        {!applicable ? (
                          <Minus size={14} className="mx-auto text-[var(--border-strong)]" />
                        ) : allowed ? (
                          <Check size={15} className="mx-auto text-[var(--success)]" strokeWidth={3} />
                        ) : (
                          <Minus size={14} className="mx-auto text-[var(--danger)] opacity-40" />
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
        <SectionHeader icon={<Settings size={15} />} title={t("profile.settings", "ການຕັ້ງຄ່າ")} tone="neutral" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[var(--text-soft)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-[var(--text-mute)]">
              <LogOut size={16} />
            </span>
            <span className="text-[12.5px] font-semibold">{t("profile.logoutDevice", "ອອກຈາກລະບົບໃນອຸປະກອນນີ້")}</span>
          </div>
          <Btn variant="danger" onClick={doLogout}>
            <LogOut size={15} /> {t("profile.logout", "ອອກຈາກລະບົບ")}
          </Btn>
        </div>
      </Card>
    </Page>
  );
}
