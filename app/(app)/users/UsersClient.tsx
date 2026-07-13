"use client";

/** v2 — User & permission management (ຜູ້ໃຊ້ & ສິດ). Manager/admin only.
 *  Create/edit login users, set their role, and grant per-module + per-action
 *  permissions to staff. Blue pastel, light.
 *
 *  Data is fetched on the SERVER in page.tsx and passed in via `initialRows`,
 *  so there is no mount→useEffect→server-action waterfall on navigation: the
 *  rows are already present in the first render. The manual refresh button and
 *  the create/update/delete flows still re-pull via the server action on demand. */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users as UsersIcon,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { getUsers, createUser, updateUser, deleteUser, type AppUserRow } from "@/_actions/users";
import {
  MODULES,
  ACTION_LABELS,
  ROLE_LABELS,
  fullPermissions,
  type Action,
  type Permissions,
  type Role,
} from "@/_lib/permissions";
import { getV2User } from "../../_lib/session";
import { isManager } from "@/_lib/permissions";
import { Page, PageHeader, Card, Btn, Field, Pill, SectionHeader, inputCls, tblCls, thCls, tdCls, trHover, type PillTone } from "../_components/ui";
import { useT } from "@/_lib/i18n";

type Draft = {
  username: string;
  name: string;
  password: string;
  role: Role;
  active: boolean;
  permissions: Permissions;
  isNew: boolean;
};

const emptyDraft = (): Draft => ({ username: "", name: "", password: "", role: "staff", active: true, permissions: {}, isNew: true });

const ROLE_TONE: Record<string, PillTone> = {
  admin: "brand",
  manager: "blue",
  head_craftsman: "cyan",
  staff: "neutral",
};

export default function UsersClient({ initialRows }: { initialRows: AppUserRow[] }) {
  const t = useT();
  const router = useRouter();
  const [rows, setRows] = useState<AppUserRow[]>(initialRows ?? []);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Client-side guard (middleware also enforces this server-side).
  useEffect(() => {
    const u = getV2User();
    if (u && !isManager(u)) router.replace("/");
  }, [router]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getUsers();
      setRows(res.success ? res.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setErr("");
    setDraft(emptyDraft());
  };
  const openEdit = (u: AppUserRow) => {
    setErr("");
    setDraft({
      username: u.username,
      name: u.name,
      password: "",
      role: (["admin", "manager", "head_craftsman", "staff"].includes(u.role) ? u.role : "staff") as Role,
      active: u.active,
      permissions: { ...(u.permissions as Permissions) },
      isNew: false,
    });
  };

  const toggle = (moduleKey: string, action: Action) => {
    setDraft((d) => {
      if (!d) return d;
      const cur = new Set(d.permissions[moduleKey] || []);
      if (cur.has(action)) {
        cur.delete(action);
        // dropping view drops the whole module's access
        if (action === "view") cur.clear();
      } else {
        cur.add(action);
        cur.add("view"); // any granted action implies view
      }
      const next = { ...d.permissions };
      if (cur.size) next[moduleKey] = [...cur] as Action[];
      else delete next[moduleKey];
      return { ...d, permissions: next };
    });
  };

  const setAllPermissions = (on: boolean) =>
    setDraft((d) => (d ? { ...d, permissions: on ? fullPermissions() : {} } : d));

  const save = async () => {
    if (!draft) return;
    setErr("");
    setSaving(true);
    try {
      const res = draft.isNew
        ? await createUser({ username: draft.username, name: draft.name, password: draft.password, role: draft.role, permissions: draft.permissions })
        : await updateUser(draft.username, { name: draft.name, role: draft.role, active: draft.active, password: draft.password || undefined, permissions: draft.permissions });
      if (!res.success) {
        setErr((res as { message?: string }).message || t("users.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
        return;
      }
      setDraft(null);
      await load();
    } catch (e) {
      setErr((e as Error).message || t("common.error", "ເກີດຂໍ້ຜິດພາດ"));
    } finally {
      setSaving(false);
    }
  };

  const del = async (u: AppUserRow) => {
    if (!window.confirm(`${t("users.deleteConfirm1", "ລຶບຜູ້ໃຊ້")} "${u.username}"? ${t("users.deleteConfirm2", "ກູ້ຄືນບໍ່ໄດ້.")}`)) return;
    const res = await deleteUser(u.username);
    if (!res.success) {
      alert((res as { message?: string }).message || t("users.deleteFailed", "ລຶບບໍ່ສຳເລັດ"));
      return;
    }
    setRows((a) => a.filter((x) => x.username !== u.username));
  };

  const counts = useMemo(() => {
    let admin = 0, manager = 0, staff = 0;
    rows.forEach((r) => {
      if (r.role === "admin") admin++;
      else if (r.role === "manager") manager++;
      else staff++;
    });
    return { total: rows.length, admin, manager, staff };
  }, [rows]);

  return (
    <Page max="max-w-none w-full">
      <PageHeader
        title={t("users.title", "ຜູ້ໃຊ້ & ສິດ")}
        subtitle={`${t("common.total", "ທັງໝົດ")} ${counts.total} · ${t("users.roleAdmin", "ຜູ້ດູແລ")} ${counts.admin} · ${t("users.roleManager", "ຜູ້ຈັດການ")} ${counts.manager} · ${t("users.roleStaff", "ພະນັກງານ")} ${counts.staff}`}
        actions={
          <>
            <Btn variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
            </Btn>
            <Btn variant="go" onClick={openNew}>
              <Plus size={14} strokeWidth={2.75} /> {t("users.createUser", "ສ້າງຜູ້ໃຊ້")}
            </Btn>
          </>
        }
      />

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex h-56 items-center justify-center gap-2 text-[var(--text-mute)]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-[var(--text-mute)]">
            <UsersIcon className="h-8 w-8 opacity-40" />
            <span className="text-sm font-semibold">{t("users.noUsers", "ຍັງບໍ່ມີຜູ້ໃຊ້")}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={thCls}>{t("users.colUser", "ຜູ້ໃຊ້")}</th>
                  <th className={`${thCls} w-32`}>{t("users.colRole", "ສິດທິ")}</th>
                  <th className={`${thCls} w-24 text-center`}>{t("common.status", "ສະຖານະ")}</th>
                  <th className={`${thCls} w-24 text-right`}>{t("common.actions", "ການດຳເນີນ")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.username} className={`${trHover} group`}>
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[11px] font-black text-[var(--brand-strong)]">
                          {(u.name || u.username).charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[var(--text)]">{u.name || u.username}</div>
                          <div className="truncate font-mono text-[11px] text-[var(--text-mute)]">
                            {u.username}
                            {u.source === "erp" && (
                              <span className="ml-1.5 rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[9px]">ERP</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={tdCls}>
                      <Pill tone={ROLE_TONE[u.role] || ROLE_TONE.staff}>{ROLE_LABELS[u.role as Role] || u.role}</Pill>
                    </td>
                    <td className={`${tdCls} text-center`}>
                      {u.active ? (
                        <Pill tone="green">{t("users.active", "ໃຊ້ງານ")}</Pill>
                      ) : (
                        <Pill tone="neutral">{t("users.inactive", "ປິດ")}</Pill>
                      )}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => openEdit(u)} title={t("common.edit", "ແກ້ໄຂ")} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-mute)] hover:bg-[var(--surface-sunken)] hover:text-[var(--brand)]">
                          <Pencil size={13} />
                        </button>
                        {u.source === "v2" && (
                          <button onClick={() => del(u)} title={t("common.delete", "ລຶບ")} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-mute)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Editor drawer */}
      {draft && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => !saving && setDraft(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
          <div
            className="animate-slide-in-right relative h-full w-full max-w-md overflow-y-auto bg-[var(--surface)] shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4">
              <SectionHeader
                icon={<ShieldCheck size={15} />}
                title={draft.isNew ? t("users.createNewUser", "ສ້າງຜູ້ໃຊ້ໃໝ່") : `${t("common.edit", "ແກ້ໄຂ")}: ${draft.username}`}
                tone="brand"
                className="mb-0"
              />
              <button onClick={() => !saving && setDraft(null)} className="cursor-pointer text-[var(--text-mute)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {err && (
                <div className="rounded-xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--danger)]">
                  {err}
                </div>
              )}

              <Field label={t("users.fieldUsername", "ຊື່ຜູ້ໃຊ້ (username)")} required>
                <input
                  className={inputCls}
                  value={draft.username}
                  disabled={!draft.isNew}
                  onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                  placeholder="username"
                />
              </Field>
              <Field label={t("users.fieldDisplayName", "ຊື່ສະແດງ")}>
                <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("users.fullNamePlaceholder", "ຊື່-ນາມສະກຸນ")} />
              </Field>
              <Field label={draft.isNew ? t("users.fieldPassword", "ລະຫັດຜ່ານ") : t("users.fieldNewPassword", "ລະຫັດຜ່ານໃໝ່ (ວ່າງ = ບໍ່ປ່ຽນ)")} required={draft.isNew}>
                <input className={inputCls} type="text" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="••••••••" />
              </Field>

              <Field label={t("users.fieldRole", "ບົດບາດ (role)")}>
                <div className="grid grid-cols-2 gap-2">
                  {(["staff", "head_craftsman", "manager", "admin"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDraft({ ...draft, role: r })}
                      className={`h-9 rounded-xl text-xs font-bold transition-all ${
                        draft.role === r
                          ? "bg-[var(--ink)] text-[var(--ink-text)]"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </Field>

              {!draft.isNew && (
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  {t("users.enableAccount", "ເປີດໃຊ້ງານບັນຊີ")}
                </label>
              )}

              {draft.role !== "admin" ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{t("users.accessPerModule", "ສິດເຂົ້າເຖິງ (ຕໍ່ module)")}</span>
                    <span className="flex gap-1.5">
                      <button type="button" onClick={() => setAllPermissions(true)} className="rounded-lg border border-[var(--brand-soft)] bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-strong)] hover:opacity-90">{t("users.selectAll", "ເລືອກທັງໝົດ")}</button>
                      <button type="button" onClick={() => setAllPermissions(false)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-mute)] hover:bg-[var(--surface-sunken)]">{t("users.clear", "ລ້າງ")}</button>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {MODULES.map((m) => (
                      <div key={m.key} className="rounded-xl border border-[var(--border)] p-2.5">
                        <div className="mb-1.5 text-[12px] font-bold text-[var(--text-soft)]">{m.label}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.actions.map((a) => {
                            const on = (draft.permissions[m.key] || []).includes(a);
                            return (
                              <button
                                key={a}
                                type="button"
                                onClick={() => toggle(m.key, a)}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                                  on
                                    ? "bg-[var(--ink)] text-[var(--ink-text)]"
                                    : "bg-[var(--surface-sunken)] text-[var(--text-mute)] hover:text-[var(--text)]"
                                }`}
                              >
                                {ACTION_LABELS[a]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--info-soft)] bg-[var(--info-soft)] px-3 py-2.5 text-[12px] font-semibold text-[var(--info)]">
                  {t("users.adminNote", "ຜູ້ດູແລລະບົບ ເຂົ້າເຖິງໄດ້ທຸກ module ແລະ ຈັດການຜູ້ໃຊ້ (ບໍ່ຕ້ອງກຳນົດສິດ).")}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4">
              <Btn variant="outline" onClick={() => setDraft(null)} disabled={saving} className="flex-1">{t("common.cancel", "ຍົກເລີກ")}</Btn>
              <Btn variant="ink" onClick={save} disabled={saving} className="flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t("common.save", "ບັນທຶກ")}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
