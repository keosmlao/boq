"use client";

/** v2 home — landing dashboard after login. Flat access: full menu for everyone. */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  FileText,
  FileSignature,
  ListChecks,
  Wrench,
  PackageOpen,
  ArrowRight,
} from "lucide-react";
import { getProjects } from "@/_actions/projects";
import { getV2User } from "../_lib/session";

const MODULES = [
  { label: "ໂຄງການ", href: "/v2/projects", icon: <FolderKanban size={20} />, desc: "ເບິ່ງ pipeline ໂຄງການ", ready: true },
  { label: "ໃບສະເໜີລາຄາ", href: "/v2/quotations", icon: <FileText size={20} />, desc: "ສ້າງ/ອະນຸມັດໃບສະເໜີ", ready: false },
  { label: "ສັນຍາ", href: "/v2/contracts", icon: <FileSignature size={20} />, desc: "ສ້າງຈາກໃບສະເໜີ + ອະນຸມັດ 2 ຂັ້ນ", ready: false },
  { label: "BOQ", href: "/v2/boq", icon: <ListChecks size={20} />, desc: "ອອກ BOQ ຈາກສັນຍາ", ready: false },
  { label: "ໃບງານ", href: "/v2/work-orders", icon: <Wrench size={20} />, desc: "ດຶງໜ້າວຽກ + BOQ", ready: false },
  { label: "ຂໍເບີກ", href: "/v2/requests", icon: <PackageOpen size={20} />, desc: "ເບີກຕາມ BOQ / ໃບງານ", ready: false },
];

export default function V2Home() {
  const [count, setCount] = useState<number | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    setName(getV2User()?.name || "");
    (async () => {
      try {
        const res: any = await getProjects();
        const data = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
        setCount(data.length);
      } catch {
        setCount(null);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <h1 className="text-[20px] font-bold text-[var(--theme-text)]">
        ສະບາຍດີ{name ? `, ${name}` : ""} 👋
      </h1>
      <p className="mt-1 text-[13px] text-[var(--theme-text-mute)]">
        ລະບົບຂາຍ ແລະ ຕິດຕັ້ງໂຄງການ — ສະບັບໃໝ່. ເຈົ້າເຂົ້າເຖິງໄດ້ທຸກໜ້າ.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="theme-card p-4">
          <div className="text-[11px] text-[var(--theme-text-mute)]">ໂຄງການທັງໝົດ</div>
          <div className="mt-1 text-2xl font-bold text-[var(--theme-text)]">
            {count === null ? "…" : count.toLocaleString()}
          </div>
        </div>
      </div>

      <h2 className="mt-7 mb-2 text-[13px] font-semibold text-[var(--theme-text-soft)]">ໂມດູນ</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) =>
          m.ready ? (
            <Link
              key={m.href}
              href={m.href}
              className="group theme-card flex items-center gap-3 p-4 transition hover:border-[var(--theme-primary)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]">
                {m.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-[var(--theme-text)]">{m.label}</div>
                <div className="truncate text-[11px] text-[var(--theme-text-mute)]">{m.desc}</div>
              </div>
              <ArrowRight size={16} className="text-[var(--theme-text-mute)] transition group-hover:translate-x-0.5 group-hover:text-[var(--theme-primary)]" />
            </Link>
          ) : (
            <div key={m.href} className="theme-card flex items-center gap-3 p-4 opacity-70">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--theme-bg-muted)] text-[var(--theme-text-mute)]">
                {m.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-[var(--theme-text-soft)]">{m.label}</div>
                <div className="truncate text-[11px] text-[var(--theme-text-mute)]">{m.desc}</div>
              </div>
              <span className="rounded bg-[var(--theme-bg-muted)] px-1.5 py-0.5 text-[9px] text-[var(--theme-text-mute)]">ໄວໆນີ້</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
