"use client";

/** v2 home — dashboard: stat tiles + recent projects + module shortcuts. Monochrome. */
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Users,
  FileText,
  FileSignature,
  ListChecks,
  CalendarRange,
  Wrench,
  PackageOpen,
  Wallet,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle,
  CircleAlert,
} from "lucide-react";
import { getProjects } from "@/_actions/projects";
import { getV2User } from "../_lib/session";
import { StatusBadge } from "@/_components/pipeline";
import { Page, Card, Btn, cardCls, tblCls, thCls, tdCls, trHover } from "./_components/ui";

const lower = (v: unknown) => (v ?? "").toString();

const MODULES = [
  { label: "ໂຄງການ", href: "/v2/projects", icon: <FolderKanban size={16} /> },
  { label: "ລູກຄ້າ", href: "/v2/customers", icon: <Users size={16} /> },
  { label: "ໃບສະເໜີລາຄາ", href: "/v2/quotations", icon: <FileText size={16} /> },
  { label: "ສັນຍາ", href: "/v2/contracts", icon: <FileSignature size={16} /> },
  { label: "BOQ", href: "/v2/boq", icon: <ListChecks size={16} /> },
  { label: "ກຳນົດໜ້າວຽກ", href: "/v2/schedule", icon: <CalendarRange size={16} /> },
  { label: "ໃບງານ", href: "/v2/work-orders", icon: <Wrench size={16} /> },
  { label: "ຂໍເບີກ", href: "/v2/requests", icon: <PackageOpen size={16} /> },
  { label: "ບັນຊີ / ງວດຈ່າຍ", href: "/v2/finance", icon: <Wallet size={16} /> },
];

const NEXT_ACTIONS: Record<string, string> = {
  "ລົງທະບຽນ": "ບັນທຶກການສຳຫຼວດ",
  "ສຳຫຼວດ": "ສ້າງໃບສະເໜີລາຄາ",
  "ສະເໜີລາຄາ": "ຕິດຕາມການອະນຸມັດ",
  "ສັນຍາ": "ສ້າງ BOQ",
  BOQ: "ກຳນົດໜ້າວຽກ",
  "ກຳນົດໜ້າວຽກ": "ອອກໃບງານ",
  "ໃບງານ": "ຕິດຕາມການຕິດຕັ້ງ",
  "ລໍຖ້າດຳເນີນ": "ເປີດເບິ່ງ ແລະ ດຳເນີນຕໍ່",
};

export default function V2Home() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  useEffect(() => {
    setName(getV2User()?.name || "");
    (async () => {
      try {
        const res: any = await getProjects({ summary: true });
        setRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    let active = 0, waiting = 0, closed = 0;
    for (const r of rows) {
      const s = lower(r.project_status);
      if (s === "ປິດໂຄງການ") closed++;
      else if (s.startsWith("ລໍຖ້າ")) waiting++;
      else active++;
    }
    return { total: rows.length, active, waiting, closed };
  }, [rows]);

  const actionRows = rows
    .filter((r) => lower(r.project_status) !== "ປິດໂຄງການ")
    .slice(0, 7);

  return (
    <Page>
      {/* Welcome banner — blue brand gradient hero */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-6 shadow-md shadow-blue-600/15">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white/90">
              ODG Workspace v2
            </div>
            <h1 className="text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
              ສະບາຍດີ{name ? `, ${name}` : ""}
            </h1>
            <p className="mt-1.5 text-xs font-medium text-white/85">
              ຍິນດີຕ້ອນຮັບເຂົ້າສູ່ລະບົບຈັດການໂຄງການ, ຂາຍ ແລະ ຕິດຕັ້ງອຸປະກອນຢ່າງເປັນລະບົບ.
            </p>
          </div>
          <Btn
            onClick={() => router.push("/v2/projects/new")}
            className="h-10 rounded-xl border-none bg-white px-5 text-xs font-black text-slate-900 shadow-lg hover:-translate-y-0.5 hover:bg-slate-100"
          >
            <Plus size={15} strokeWidth={3} /> ລົງທະບຽນໂຄງການ
          </Btn>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="ໂຄງການທັງໝົດ" value={stats.total} loading={loading} icon={<FolderKanban size={16} />} />
        <Stat label="ກຳລັງດຳເນີນ" value={stats.active} loading={loading} icon={<TrendingUp size={16} />} />
        <Stat label="ລໍຖ້າດຳເນີນ" value={stats.waiting} loading={loading} icon={<Clock size={16} />} />
        <Stat label="ປິດແລ້ວ" value={stats.closed} loading={loading} icon={<CheckCircle size={16} />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Next work */}
        <Card className="overflow-hidden border border-slate-200 bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-800">
                <CircleAlert size={15} className="text-blue-600" /> ວຽກທີ່ຕ້ອງເຮັດຕໍ່
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">ເປີດໂຄງການ ແລະ ດຳເນີນຂັ້ນຕອນຕໍ່ໄປ</p>
            </div>
            <Link href="/v2/projects" className="inline-flex h-7 items-center rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50">
              ເບິ່ງທັງໝົດ
            </Link>
          </div>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                <span className="text-xs font-semibold">ກຳລັງໂຫຼດຂໍ້ມູນ...</span>
              </div>
            </div>
          ) : actionRows.length === 0 ? (
            <div className="py-16 text-center text-xs font-semibold text-slate-400">
              <CheckCircle size={32} className="mx-auto mb-2 text-emerald-300" />
              ບໍ່ມີວຽກຄ້າງດຳເນີນ
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={tblCls}>
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className={`${thCls} pl-5`}>ໂຄງການ</th>
                    <th className={`${thCls} hidden sm:table-cell`}>ສະຖານະປັດຈຸບັນ</th>
                    <th className={`${thCls} pr-5`}>ວຽກຕໍ່ໄປ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {actionRows.map((r, i) => (
                    <tr
                      key={r.id ?? i}
                      onClick={() => router.push(`/v2/projects/${encodeURIComponent(String(r.id))}`)}
                      className={`${trHover} group cursor-pointer`}
                    >
                      <td className={`${tdCls} pl-5 font-bold text-slate-900 transition-colors group-hover:text-slate-950`}>{r.project_name || "(ບໍ່ມີຊື່)"}</td>
                      <td className={`${tdCls} hidden sm:table-cell`}><StatusBadge status={r.project_status} /></td>
                      <td className={`${tdCls} pr-5`}>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700">
                          {NEXT_ACTIONS[lower(r.project_status)] || "ເປີດເບິ່ງໂຄງການ"} <ArrowRight size={13} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Module shortcuts */}
        <Card className="border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-sm font-black text-slate-800">ໂມດູນການເຮັດວຽກ</h2>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">ທາງລັດເຂົ້າຫາໂມດູນລະບົບ</p>
          </div>
          <div className="space-y-2">
            {MODULES.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-transform duration-150 group-hover:scale-105">
                  {m.icon}
                </span>
                <span className="flex-1 text-[12.5px] font-bold text-slate-700 transition-colors group-hover:text-slate-950">{m.label}</span>
                <ArrowRight size={14} className="text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-slate-600" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  );
}

function Stat({ label, value, loading, icon }: { label: string; value: number; loading: boolean; icon: React.ReactNode }) {
  return (
    <div className={`${cardCls} flex items-center justify-between p-4`}>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
        <div className="font-display mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
          {loading ? "…" : value.toLocaleString()}
        </div>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">{icon}</div>
    </div>
  );
}
