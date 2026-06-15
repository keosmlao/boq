"use client";

/**
 * Searchable picker over ic_inventory (ERP products). Type to search by code or
 * name; selecting fills code / name / unit / price. Free text is still allowed
 * (for non-stock lines). Dropdown is fixed-positioned to avoid table clipping.
 */
import React, { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { getInventory } from "@/_actions/lookups";

export type InvItem = { code: string; name: string; unit: string; price: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function InventoryPicker({
  value,
  onText,
  onSelect,
  placeholder = "ຄົ້ນຫາສິນຄ້າ (ລະຫັດ/ຊື່)...",
}: {
  value: string;
  onText: (t: string) => void;
  onSelect: (item: InvItem) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = () => {
    const r = boxRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 320) });
  };

  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res: any = await getInventory({ search: q, limit: 20 });
        setResults(res?.success ? res.data || [] : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  useEffect(() => {
    if (!open) return;
    // Reposition the dropdown to follow the input on page scroll — but do NOT
    // close, otherwise scrolling INSIDE the results list closes it.
    const onScroll = (e: Event) => {
      if (dropRef.current && dropRef.current.contains(e.target as Node)) return;
      place();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const pick = (it: any) => {
    onSelect({
      code: String(it.code ?? ""),
      name: String(it.name_1 ?? it.item_name ?? it.code ?? ""),
      unit: String(it.unit ?? it.unit_code ?? it.unit_name ?? ""),
      price: num(it.sale_price ?? it.unit_cost),
    });
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--theme-border-subtle)] px-2 focus-within:border-[var(--theme-primary)] focus-within:ring-2 focus-within:ring-[var(--theme-primary-tint)]">
        <Search size={13} className="text-[var(--theme-text-mute)]" />
        <input
          value={value}
          onChange={(e) => {
            onText(e.target.value);
            place();
            setOpen(true);
            search(e.target.value);
          }}
          onFocus={() => {
            place();
            setOpen(true);
            if (!results.length) search(value);
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
        />
      </div>

      {open && rect && (
        <div
          ref={dropRef}
          className="fixed z-[9999] max-h-72 overflow-y-auto rounded-md border border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow-lg)]"
          style={{ top: rect.top, left: rect.left, width: rect.width }}
        >
          {loading ? (
            <div className="px-3 py-2 text-center text-[12px] text-[var(--theme-text-mute)]">ກຳລັງຄົ້ນຫາ...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-center text-[12px] text-[var(--theme-text-mute)]">ບໍ່ພົບສິນຄ້າ</div>
          ) : (
            results.map((it, i) => (
              <button
                key={`${it.code}-${i}`}
                type="button"
                onClick={() => pick(it)}
                className="block w-full border-b border-[var(--theme-border-subtle)] px-3 py-1.5 text-left last:border-0 hover:bg-[var(--theme-bg-muted)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-[var(--theme-primary)]">{it.code}</span>
                  <span className="text-[11px] tabular-nums text-[var(--theme-text-soft)]">
                    {num(it.sale_price ?? it.unit_cost).toLocaleString("en-US")}
                  </span>
                </div>
                <div className="truncate text-[12px] text-[var(--theme-text)]">{it.name_1 ?? it.item_name ?? "-"}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
