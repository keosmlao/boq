"use client";

/** v2 — Customer detail: info + their projects + register a new project. */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone, MapPin, Plus, FolderOpen, ChevronRight, Loader2, Hash } from "lucide-react";
import { getCustomer } from "@/_actions/customers";
import { getProjects } from "@/_actions/projects";
import { StatusBadge } from "@/_components/pipeline";
import { Page, PageHeader, Card, Btn, SectionHeader, tblCls, thCls, tdCls, trHover } from "../../_components/ui";
import { useT } from "@/_lib/i18n";

export default function CustomerDetailPage() {
  const t = useT();
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
    () => `/projects/new?cust=${encodeURIComponent(custCode)}&name=${encodeURIComponent(custName)}`,
    [custCode, custName],
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2.5 text-[var(--text-mute)]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-[13px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }

  const chip = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-soft)]";

  return (
    <Page max="max-w-[1100px]">
      <PageHeader
        title={custName}
        subtitle={[custCode, customer?.phone, customer?.address].filter(Boolean).join(" · ")}
        actions={
          <>
            <Btn variant="go" onClick={() => router.push(registerHref)}>
              <Plus size={14} strokeWidth={2.75} /> {t("customers.registerProject", "ລົງທະບຽນໂຄງການ")}
            </Btn>
            <Btn variant="outline" onClick={() => router.push("/customers")}>
              <ArrowLeft size={14} /> {t("customers.backToList", "ກັບໄປລາຍຊື່ລູກຄ້າ")}
            </Btn>
          </>
        }
      />

      {/* Customer info chips */}
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${chip} font-mono`}>
            <Hash size={12} strokeWidth={2.5} className="text-[var(--text-mute)]" /> {custCode}
          </span>
          {customer?.phone && (
            <span className={chip}>
              <Phone size={12} strokeWidth={2.5} className="text-[var(--brand)]" /> {customer.phone}
            </span>
          )}
          {customer?.address && (
            <span className={chip}>
              <MapPin size={12} strokeWidth={2.5} className="text-[var(--brand)]" /> {customer.address}
            </span>
          )}
        </div>
      </Card>

      {/* Their projects */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 pt-5">
          <SectionHeader icon={<FolderOpen size={14} />} title={t("customers.customerProjects", "ໂຄງການຂອງລູກຄ້າ")} tone="brand" />
          <span className="mb-4 rounded-full border border-[var(--border)] bg-[var(--surface-sunken)] px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text-mute)]">
            {projects.length} {t("customers.projectsUnit", "ໂຄງການ")}
          </span>
        </div>
        {projects.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-[var(--text-mute)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-sunken)] text-[var(--text-mute)]">
              <FolderOpen className="h-7 w-7" />
            </div>
            <span className="text-[12.5px] font-semibold">{t("customers.noProjects", "ຍັງບໍ່ມີໂຄງການ")}</span>
            <Btn variant="go" onClick={() => router.push(registerHref)} className="mt-1">
              <Plus size={14} strokeWidth={2.75} /> {t("customers.registerProject", "ລົງທະບຽນໂຄງການ")}
            </Btn>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} pl-5`}>{t("customers.projectsUnit", "ໂຄງການ")}</th>
                  <th className={`${thCls} hidden lg:table-cell`}>{t("customers.location", "ສະຖານທີ່")}</th>
                  <th className={thCls}>{t("common.status", "ສະຖານະ")}</th>
                  <th className={`${thCls} w-10 pr-5`} />
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr
                    key={p.id ?? i}
                    onClick={() => router.push(`/projects/${encodeURIComponent(String(p.id))}`)}
                    className={`group cursor-pointer ${trHover}`}
                  >
                    <td className={`${tdCls} pl-5 font-semibold text-[var(--text)]`}>{p.project_name || t("customers.noName", "(ບໍ່ມີຊື່)")}</td>
                    <td className={`${tdCls} hidden lg:table-cell`}>{p.province_name || "-"}</td>
                    <td className={tdCls}><StatusBadge status={p.project_status} /></td>
                    <td className={`${tdCls} pr-5 text-right`}>
                      <ChevronRight className="inline-block h-4 w-4 text-[var(--text-mute)] transition-transform group-hover:translate-x-0.5" />
                    </td>
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
