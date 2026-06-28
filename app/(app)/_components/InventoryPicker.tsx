"use client";

/**
 * Product picker — a clean modal search (instead of a floating dropdown that
 * overlapped surrounding content). Selecting fills code / name / unit / price;
 * free text is still allowed via the "use this text" row, so custom line items
 * (not in inventory) can still be entered.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, Package } from "lucide-react";
import { getInventory } from "@/_actions/lookups";
import { useT } from "@/_lib/i18n";

export type InvItem = { code: string; name: string; unit: string; price: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function InventoryPicker({
  value,
  onText,
  onSelect,
  placeholder,
}: {
  value: string;
  onText: (t: string) => void;
  onSelect: (item: InvItem) => void;
  placeholder?: string;
}) {
  const t = useT();
  const ph = placeholder ?? t("components.inventoryPicker.searchPlaceholder", "ຄົ້ນຫາສິນຄ້າ (ລະຫັດ/ຊື່)...");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Debounced search while the modal is open.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const h = setTimeout(async () => {
      try {
        const res: any = await getInventory({ search: q.trim(), limit: 30 });
        setResults(res?.success ? res.data || [] : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [open, q]);

  const openModal = () => {
    setQ(value || "");
    setOpen(true);
  };

  const pick = (it: any) => {
    onSelect({
      code: String(it.code ?? ""),
      name: String(it.name_1 ?? it.item_name ?? it.code ?? ""),
      unit: String(it.unit ?? it.unit_code ?? it.unit_name ?? ""),
      price: num(it.sale_price ?? it.unit_cost),
    });
    setOpen(false);
  };

  const useFreeText = () => {
    onText(q.trim());
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex h-8 w-full items-center gap-1.5 rounded-md border border-[var(--theme-border-subtle)] px-2 text-left hover:border-[var(--theme-primary)] focus:border-[var(--theme-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-tint)]"
      >
        <Search size={13} className="flex-shrink-0 text-[var(--theme-text-mute)]" />
        <span className={`truncate text-[12.5px] ${value ? "text-[var(--theme-text)]" : "text-[var(--theme-text-mute)]"}`}>{value || ph}</span>
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 px-3 pt-[10vh]" onClick={() => setOpen(false)}>
          <div className="flex max-h-[78vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-[var(--theme-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2.5">
              <Search size={15} className="text-[var(--theme-text-mute)]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  onText(e.target.value);
                }}
                placeholder={ph}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
              <button type="button" onClick={() => setOpen(false)} className="text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]"><X size={17} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {q.trim() && (
                <button
                  type="button"
                  onClick={useFreeText}
                  className="flex w-full items-center gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2 text-left hover:bg-[var(--theme-bg-muted)]"
                >
                  <Package size={14} className="flex-shrink-0 text-[var(--theme-text-mute)]" />
                  <span className="text-[12px] text-[var(--theme-text-soft)]">{t("components.inventoryPicker.useText", "ໃຊ້ຂໍ້ຄວາມນີ້")}: <strong className="text-[var(--theme-text)]">{q.trim()}</strong></span>
                </button>
              )}
              {loading ? (
                <div className="px-3 py-10 text-center text-[12px] text-[var(--theme-text-mute)]">{t("components.picker.searching", "ກຳລັງຄົ້ນຫາ...")}</div>
              ) : results.length === 0 ? (
                <div className="px-3 py-10 text-center text-[12px] text-[var(--theme-text-mute)]">{t("components.inventoryPicker.notFound", "ບໍ່ພົບສິນຄ້າ")}</div>
              ) : (
                results.map((it, i) => (
                  <button
                    key={`${it.code}-${i}`}
                    type="button"
                    onClick={() => pick(it)}
                    className="block w-full border-b border-[var(--theme-border-subtle)] px-3 py-2 text-left last:border-0 hover:bg-[var(--theme-bg-muted)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11.5px] font-semibold text-[var(--theme-primary)]">{it.code}</span>
                      <span className="text-[11.5px] tabular-nums text-[var(--theme-text-soft)]">{num(it.sale_price ?? it.unit_cost).toLocaleString("en-US")}</span>
                    </div>
                    <div className="truncate text-[12.5px] text-[var(--theme-text)]">{it.name_1 ?? it.item_name ?? "-"}</div>
                    {(it.category_name || it.brand_name) && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {it.category_name && (
                          <span className="rounded bg-[var(--theme-bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--theme-text-mute)]">{t("components.inventoryPicker.category", "ປະເພດ")}: {it.category_name}</span>
                        )}
                        {it.brand_name && (
                          <span className="rounded bg-[var(--theme-bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--theme-text-mute)]">{t("components.inventoryPicker.brand", "ຫຍີ່ຫໍ້")}: {it.brand_name}</span>
                        )}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
