"use client";

/** v2 — Customer detail: info + their projects + register a new project. */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone, MapPin, Plus, FolderOpen, ChevronRight } from "lucide-react";
import { getCustomer } from "@/_actions/customers";
import { getProjects } from "@/_actions/projects";
import { StatusBadge } from "@/_components/pipeline";
import { Page, Card, Btn, tblCls, thCls, tdCls } from "../../_components/ui";

export default function CustomerDetailPage() {
  const { code } = useParams();
  const router = useRouter();
  const custCode = decodeURIComponent(String(code || ""));

  const [customer, setCustomer] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cRes, pRes]: any = await Promise.all([
          getCustomer(custCode),
          getProjects({ summary: true }),
        ]);
        if (!alive) return;
        setCustomer(cRes?.success ? cRes.data : null);
        const all = pRes?.success ? pRes.data || [] : [];
        setProjects(all.filter((p: any) => String(p.sml_code ?? "") === custCode));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [custCode]);

  const custName = customer?.name || custCode;
  const registerHref = useMemo(
    () => `/v2/projects/new?cust=${encodeURIComponent(custCode)}&name=${encodeURIComponent(custName)}`,
    [custCode, custName],
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }

  return (
    <Page>
      <button
        onClick={() => router.push("/v2/customers")}
        className="group mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> ກັບໄປລາຍຊື່ລູກຄ້າ
      </button>

      {/* Customer header */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="font-display flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl premium-gradient text-xl font-black text-white shadow-md shadow-blue-600/25">
              {(custName || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight text-slate-900">{custName}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-600">
                  {custCode}
                </span>
                {customer?.phone && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    <Phone size={12} strokeWidth={2.5} className="text-blue-500" /> {customer.phone}
                  </span>
                )}
                {customer?.address && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    <MapPin size={12} strokeWidth={2.5} className="text-blue-500" /> {customer.address}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Btn onClick={() => router.push(registerHref)}>
            <Plus size={14} strokeWidth={2.75} /> ລົງທະບຽນໂຄງການ
          </Btn>
        </div>
      </Card>

      {/* Their projects */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
          <h2 className="flex items-center gap-2.5 text-sm font-black text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <FolderOpen size={15} />
            </span>
            ໂຄງການຂອງລູກຄ້າ
          </h2>
          <span className="font-display rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
            {projects.length} ໂຄງການ
          </span>
        </div>
        {projects.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-slate-400">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
              <FolderOpen className="h-7 w-7" />
            </div>
            <span className="text-sm font-semibold">ຍັງບໍ່ມີໂຄງການ</span>
            <Btn onClick={() => router.push(registerHref)} className="mt-1">
              <Plus size={14} strokeWidth={2.75} /> ລົງທະບຽນໂຄງການ
            </Btn>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} pl-5`}>ໂຄງການ</th>
                  <th className={`${thCls} hidden lg:table-cell`}>ສະຖານທີ່</th>
                  <th className={thCls}>ສະຖານະ</th>
                  <th className={`${thCls} w-10 pr-5`} />
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr
                    key={p.id ?? i}
                    onClick={() => router.push(`/v2/projects/${encodeURIComponent(String(p.id))}`)}
                    className="group cursor-pointer transition-colors hover:bg-blue-50/40"
                  >
                    <td className={`${tdCls} pl-5 font-bold text-slate-900 group-hover:text-blue-700 transition-colors`}>{p.project_name || "(ບໍ່ມີຊື່)"}</td>
                    <td className={`${tdCls} hidden text-slate-500 lg:table-cell`}>{p.province_name || "-"}</td>
                    <td className={tdCls}><StatusBadge status={p.project_status} /></td>
                    <td className={`${tdCls} pr-5 text-right`}><ChevronRight className="inline-block h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-500" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
