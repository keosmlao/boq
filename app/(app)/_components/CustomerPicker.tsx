"use client";

/**
 * Customer selector for the project form: search existing v2 customers, and if
 * not found, create one inline (quick create) without leaving the page.
 */
import React, { useEffect, useRef, useState } from "react";
import { Search, X, UserPlus, Check, Loader2, ChevronDown } from "lucide-react";
import { getCustomers, createCustomer } from "@/_actions/customers";
import { inputCls } from "./ui";
import { useT } from "@/_lib/i18n";

export type PickedCustomer = {
  code: string;
  name: string;
  phone?: string;
  province?: string;
  district?: string;
  village?: string;
  address?: string;
};

export default function CustomerPicker({
  value,
  onChange,
}: {
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cErr, setCErr] = useState("");
  const [c, setC] = useState({ name: "", customerType: "ລູກຄ້າໂຄງການ", phone: "", address: "" });

  const search = (term: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res: any = await getCustomers({ search: term });
        setResults(res?.success ? res.data || [] : []);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (r: any) => {
    onChange({
      code: String(r.code),
      name: String(r.name || r.code),
      phone: r.phone || "",
      province: r.province || "",
      district: r.district || "",
      village: r.village || "",
      address: r.address || "",
    });
    setOpen(false);
    setQ("");
  };

  const submitCreate = async () => {
    setCErr("");
    if (!c.name.trim()) {
      setCErr(t("components.customerPicker.nameRequired", "ກະລຸນາໃສ່ຊື່ລູກຄ້າ"));
      return;
    }
    setCreating(true);
    try {
      const res: any = await createCustomer(c);
      if (res?.success) {
        onChange({ code: String(res.data.code), name: String(res.data.name), phone: c.phone || res.data.phone || "", address: c.address || "" });
        setShowCreate(false);
        setOpen(false);
        setC({ name: "", customerType: "ລູກຄ້າໂຄງການ", phone: "", address: "" });
      } else {
        setCErr(res?.message || t("components.customerPicker.createFailed", "ສ້າງບໍ່ສຳເລັດ"));
      }
    } catch (e: any) {
      setCErr(e?.message || t("common.error", "ເກີດຂໍ້ຜິດພາດ"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      {value ? (
        <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-[var(--theme-primary-soft)] bg-[var(--theme-primary-tint)] px-3">
          <span className="truncate text-[13px] font-medium text-[var(--theme-text)]">
            {value.name} <span className="font-mono text-[11px] text-[var(--theme-text-mute)]">({value.code})</span>
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-[var(--theme-text-mute)] hover:text-rose-600" title={t("components.customerPicker.change", "ປ່ຽນ")}>
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            if (!results.length) search("");
          }}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] px-3 text-left text-[13px] text-[var(--theme-text-mute)] hover:border-[var(--theme-primary-soft)]"
        >
          <Search size={14} />
          <span className="flex-1">{t("components.customerPicker.selectOrSearch", "ເລືອກ ຫຼື ຄົ້ນຫາລູກຄ້າ...")}</span>
          <ChevronDown size={15} />
        </button>
      )}

      {open && !value && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow-lg)]">
          <div className="border-b border-[var(--theme-border-subtle)] p-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] px-2">
              <Search size={13} className="text-[var(--theme-text-mute)]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  search(e.target.value);
                }}
                placeholder={t("components.customerPicker.searchPlaceholder", "ຄົ້ນຫາຊື່ ຫຼື ລະຫັດ...")}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
              />
              {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--theme-primary)] border-t-transparent" />}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12px] text-[var(--theme-text-mute)]">
                {loading ? t("components.picker.searching", "ກຳລັງຄົ້ນຫາ...") : t("components.customerPicker.notFound", "ບໍ່ພົບລູກຄ້າ")}
              </div>
            ) : (
              results.map((r, i) => (
                <button
                  key={`${r.code}-${i}`}
                  type="button"
                  onClick={() => pick(r)}
                  className="block w-full border-b border-[var(--theme-border-subtle)] px-3 py-2 text-left last:border-0 hover:bg-[var(--theme-bg-muted)]"
                >
                  <div className="text-[12.5px] font-medium text-[var(--theme-text)]">{r.name}</div>
                  <div className="font-mono text-[10.5px] text-[var(--theme-text-mute)]">{r.code} · {r.customer_type || "-"}</div>
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/50 px-3 py-2 text-[12.5px] font-semibold text-[var(--theme-primary)] hover:bg-[var(--theme-bg-muted)]"
          >
            <UserPlus size={14} /> {t("components.customerPicker.createNew", "ສ້າງລູກຄ້າໃໝ່")}
          </button>
        </div>
      )}

      {/* Quick-create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[12vh]" onClick={() => !creating && setShowCreate(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-[var(--theme-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 bg-gradient-to-r from-[var(--theme-primary)] to-blue-500 px-4 py-3 text-white">
              <UserPlus size={18} />
              <h3 className="text-[14px] font-bold">{t("components.customerPicker.createNew", "ສ້າງລູກຄ້າໃໝ່")}</h3>
            </div>
            <div className="space-y-3 p-4">
              {cErr && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] text-rose-700">{cErr}</div>}
              <Field label={t("components.customerPicker.nameLabel", "ຊື່ລູກຄ້າ")} required>
                <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className={inputCls} placeholder={t("components.customerPicker.nameLabel", "ຊື່ລູກຄ້າ")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("components.customerPicker.typeLabel", "ປະເພດ")}>
                  <select value={c.customerType} onChange={(e) => setC({ ...c, customerType: e.target.value })} className={inputCls}>
                    <option value="ລູກຄ້າໂຄງການ">{t("components.customerPicker.typeProject", "ລູກຄ້າໂຄງການ")}</option>
                    <option value="ລູກຄ້າທົ່ວໄປ">{t("components.customerPicker.typeGeneral", "ລູກຄ້າທົ່ວໄປ")}</option>
                    <option value="ຮ້ານຄ້າ">{t("components.customerPicker.typeShop", "ຮ້ານຄ້າ")}</option>
                  </select>
                </Field>
                <Field label={t("common.phone", "ເບີໂທ")}>
                  <input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} className={inputCls} placeholder="020..." />
                </Field>
              </div>
              <Field label={t("components.customerPicker.addressLabel", "ທີ່ຢູ່")}>
                <input value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} className={inputCls} placeholder={t("components.customerPicker.addressLabel", "ທີ່ຢູ່")} />
              </Field>
            </div>
            <div className="flex gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-3">
              <button type="button" onClick={() => setShowCreate(false)} disabled={creating} className="flex-1 rounded-md border border-[var(--theme-border-subtle)] bg-white py-2 text-[12px] font-semibold text-[var(--theme-text-soft)] hover:bg-[var(--theme-bg-muted)] disabled:opacity-60">
                {t("common.cancel", "ຍົກເລີກ")}
              </button>
              <button type="button" onClick={submitCreate} disabled={creating} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--theme-primary)] py-2 text-[12px] font-semibold text-white hover:bg-[var(--theme-primary-strong)] disabled:opacity-60">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {creating ? t("components.customerPicker.creating", "ກຳລັງສ້າງ...") : t("components.customerPicker.createSelect", "ສ້າງ & ເລືອກ")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11.5px] font-medium text-[var(--theme-text-soft)]">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
