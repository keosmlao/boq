"use client";

/** v2 — User & permission management (ຜູ້ໃຊ້ & ສິດ). Manager/admin only.
 *  Create/edit login users, set their role, and grant per-module + per-action
 *  permissions to staff. Blue pastel, light. */
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
  type Action,
  type Permissions,
  type Role,
} from "@/_lib/permissions";
import { getV2User } from "../../_lib/session";
import { isManager } from "@/_lib/permissions";
import { Page, PageHeader, Card, Btn, Field, inputCls } from "../_components/ui";

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

const ROLE_TONE: Record<string, string> = {
  admin: "bg-blue-600 text-white",
  manager: "bg-blue-100 text-blue-700 border border-blue-200",
  staff: "bg-slate-100 text-slate-600 border border-slate-200",
};

export default function UsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AppUserRow[]>([]);
  const [loading, setLoading] = useState(true);
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
  useEffect(() => {
    void load();
  }, []);

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
      role: (["admin", "manager", "staff"].includes(u.role) ? u.role : "staff") as Role,
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

  const save = async () => {
    if (!draft) return;
    setErr("");
    setSaving(true);
    try {
      const res = draft.isNew
        ? await createUser({ username: draft.username, name: draft.name, password: draft.password, role: draft.role, permissions: draft.permissions })
        : await updateUser(draft.username, { name: draft.name, role: draft.role, active: draft.active, password: draft.password || undefined, permissions: draft.permissions });
      if (!res.success) {
        setErr((res as { message?: string }).message || "ບັນທຶກບໍ່ສຳເລັດ");
        return;
      }
      setDraft(null);
      await load();
    } catch (e) {
      setErr((e as Error).message || "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setSaving(false);
    }
  };

  const del = async (u: AppUserRow) => {
    if (!window.confirm(`ລຶບຜູ້ໃຊ້ "${u.username}"? ກູ້ຄືນບໍ່ໄດ້.`)) return;
    const res = await deleteUser(u.username);
    if (!res.success) {
      alert((res as { message?: string }).message || "ລຶບບໍ່ສຳເລັດ");
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
        title="ຜູ້ໃຊ້ & ສິດ"
        subtitle={`ທັງໝົດ ${counts.total} · ຜູ້ດູແລ ${counts.admin} · ຜູ້ຈັດການ ${counts.manager} · ພະນັກງານ ${counts.staff}`}
        actions={
          <>
            <Btn variant="outline" onClick={() => void load()} disabled={loading} className="h-10 w-10 p-0 rounded-xl">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </Btn>
            <Btn onClick={openNew} className="h-10 rounded-xl">
              <Plus size={14} strokeWidth={2.75} /> ສ້າງຜູ້ໃຊ້
            </Btn>
          </>
        }
      />

      <Card className="overflow-hidden border border-slate-200 rounded-2xl">
        {loading ? (
          <div className="flex h-56 items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-400">
            <UsersIcon className="h-8 w-8 opacity-40" />
            <span className="text-sm font-semibold">ຍັງບໍ່ມີຜູ້ໃຊ້</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* head */}
            <div className="flex items-center gap-3.5 bg-slate-50/70 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="flex-1">ຜູ້ໃຊ້</span>
              <span className="w-28 text-left">ສິດທິ</span>
              <span className="w-20 text-center">ສະຖານະ</span>
              <span className="w-16" />
            </div>
            {rows.map((u) => (
              <div key={u.username} className="group flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-slate-50/50">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">
                  {(u.name || u.username).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-800">{u.name || u.username}</div>
                  <div className="mt-0.5 truncate font-mono text-[10.5px] font-medium text-slate-400">
                    {u.username}
                    {u.source === "erp" && <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-400">ERP</span>}
                  </div>
                </div>
                <span className="w-28">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${ROLE_TONE[u.role] || ROLE_TONE.staff}`}>
                    {ROLE_LABELS[(u.role as Role)] || u.role}
                  </span>
                </span>
                <span className="w-20 text-center">
                  {u.active ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-600"><Check size={12} /> ໃຊ້ງານ</span>
                  ) : (
                    <span className="text-[10.5px] font-bold text-slate-400">ປິດ</span>
                  )}
                </span>
                <div className="flex w-16 flex-shrink-0 items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(u)} title="ແກ້ໄຂ" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
                    <Pencil size={13} />
                  </button>
                  {u.source === "v2" && (
                    <button onClick={() => del(u)} title="ລຶບ" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Editor drawer */}
      {draft && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => !saving && setDraft(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" />
          <div
            className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/90 px-5 py-4 backdrop-blur">
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <ShieldCheck size={16} className="text-blue-600" />
                {draft.isNew ? "ສ້າງຜູ້ໃຊ້ໃໝ່" : `ແກ້ໄຂ: ${draft.username}`}
              </h2>
              <button onClick={() => !saving && setDraft(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">{err}</div>}

              <Field label="ຊື່ຜູ້ໃຊ້ (username)" required>
                <input
                  className={inputCls}
                  value={draft.username}
                  disabled={!draft.isNew}
                  onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                  placeholder="username"
                />
              </Field>
              <Field label="ຊື່ສະແດງ">
                <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ຊື່-ນາມສະກຸນ" />
              </Field>
              <Field label={draft.isNew ? "ລະຫັດຜ່ານ" : "ລະຫັດຜ່ານໃໝ່ (ວ່າງ = ບໍ່ປ່ຽນ)"} required={draft.isNew}>
                <input className={inputCls} type="text" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="••••••••" />
              </Field>

              <Field label="ບົດບາດ (role)">
                <div className="grid grid-cols-3 gap-2">
                  {(["staff", "manager", "admin"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDraft({ ...draft, role: r })}
                      className={`h-9 rounded-xl text-xs font-bold transition-all ${
                        draft.role === r ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </Field>

              {!draft.isNew && (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-blue-600" />
                  ເປີດໃຊ້ງານບັນຊີ
                </label>
              )}

              {draft.role === "staff" ? (
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">ສິດເຂົ້າເຖິງ (ຕໍ່ module)</div>
                  <div className="space-y-1.5">
                    {MODULES.map((m) => (
                      <div key={m.key} className="rounded-xl border border-slate-200 p-2.5">
                        <div className="mb-1.5 text-[12px] font-bold text-slate-700">{m.label}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.actions.map((a) => {
                            const on = (draft.permissions[m.key] || []).includes(a);
                            return (
                              <button
                                key={a}
                                type="button"
                                onClick={() => toggle(m.key, a)}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                                  on ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12px] font-semibold text-blue-700">
                  {draft.role === "admin" ? "ຜູ້ດູແລ" : "ຜູ້ຈັດການ"} ເຂົ້າເຖິງໄດ້ທຸກ module ແລະ ຈັດການຜູ້ໃຊ້.
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white/90 px-5 py-4 backdrop-blur">
              <Btn variant="outline" onClick={() => setDraft(null)} disabled={saving} className="flex-1">ຍົກເລີກ</Btn>
              <Btn onClick={save} disabled={saving} className="flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} ບັນທຶກ
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
