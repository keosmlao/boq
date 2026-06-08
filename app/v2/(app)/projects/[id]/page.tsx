"use client";

/** v2 project pipeline — real data; stepper + current stage + tabs. */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone, MapPin, User } from "lucide-react";
import { getProjectsBoq } from "@/_actions/projects";
import { getQuotations } from "@/_actions/quotations";
import { computeStages, StageStepper, StatusBadge, type Stage } from "@/_components/pipeline";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US");
};

type TabKey = "overview" | "quotations" | "contracts" | "boq";

export default function V2PipelinePage() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [boqRes, qRes]: any = await Promise.all([
          getProjectsBoq({ projectId: String(id) }),
          getQuotations({ projectId: String(id) }),
        ]);
        if (!alive) return;
        const rows = boqRes?.success ? boqRes.data || [] : [];
        setProject(rows[0] || null);
        setQuotations(qRes?.success ? qRes.data || [] : Array.isArray(qRes) ? qRes : []);
      } catch {
        if (alive) setProject(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const contracts: any[] = useMemo(
    () => (Array.isArray(project?.contractlist) ? project.contractlist : []),
    [project],
  );
  const boqs = useMemo(
    () =>
      contracts.flatMap((c) =>
        (Array.isArray(c?.boq_list) ? c.boq_list : []).map((b: any) => ({ ...b, contract_no: c.contract_no })),
      ),
    [contracts],
  );
  const stages: Stage[] = useMemo(
    () => (project ? computeStages(project, quotations, contracts) : []),
    [project, quotations, contracts],
  );
  const current = stages.find((s) => s.state === "current");

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-10 text-center text-[var(--theme-text-mute)]">
        ບໍ່ພົບໂຄງການ
        <div className="mt-3">
          <button onClick={() => router.push("/v2/projects")} className="text-[var(--theme-primary)] hover:underline">
            ← ກັບໄປລາຍການ
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; n?: number }[] = [
    { key: "overview", label: "ພາບລວມ" },
    { key: "quotations", label: "ໃບສະເໜີ", n: quotations.length },
    { key: "contracts", label: "ສັນຍາ", n: contracts.length },
    { key: "boq", label: "BOQ", n: boqs.length },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5">
      <button
        onClick={() => router.push("/v2/projects")}
        className="mb-2 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]"
      >
        <ArrowLeft size={14} /> ກັບໄປລາຍການໂຄງການ
      </button>

      <div className="theme-card mb-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold text-[var(--theme-text)]">{project.project_name || "(ບໍ່ມີຊື່)"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--theme-text-mute)]">
              {project.sml_code && <span className="inline-flex items-center gap-1"><User size={12} /> ລູກຄ້າ {project.sml_code}</span>}
              {project.coordinator && <span className="inline-flex items-center gap-1"><User size={12} /> {project.coordinator}</span>}
              {project.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {project.phone}</span>}
              {project.province_name && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {project.province_name}</span>}
            </div>
          </div>
          <StatusBadge status={project.project_status} />
        </div>
        <div className="mt-4">
          <StageStepper stages={stages} />
        </div>
      </div>

      {current && (
        <div className="theme-card mb-3 border-l-4 border-[var(--theme-primary)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-text-mute)]">ຂັ້ນຕອນປັດຈຸບັນ</div>
          <div className="mt-1 text-[16px] font-bold text-[var(--theme-primary)]">{current.label}</div>
          <div className="text-[12px] text-[var(--theme-text-soft)]">{current.detail}</div>
        </div>
      )}

      <div className="theme-card overflow-hidden">
        <div className="flex gap-1 border-b border-[var(--theme-border-subtle)] px-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-3 py-2.5 text-[12px] font-medium transition ${
                tab === t.key ? "text-[var(--theme-primary)]" : "text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]"
              }`}
            >
              {t.label}
              {typeof t.n === "number" && <span className="ml-1 text-[10px] text-[var(--theme-text-mute)]">({t.n})</span>}
              {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-[var(--theme-primary)]" />}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "overview" && (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
              <Row label="ຊື່ໂຄງການ" value={project.project_name} />
              <Row label="ສະຖານະ" value={project.project_status} />
              <Row label="ລະຫັດລູກຄ້າ" value={project.sml_code} />
              <Row label="ຜູ້ປະສານ" value={project.coordinator} />
              <Row label="ໂທ" value={project.phone} />
              <Row label="ແຂວງ" value={project.province_name} />
              <Row label="ເມືອງ" value={project.district_name} />
              <Row label="ບ້ານ" value={project.village_name} />
              <Row label="ຈຳນວນສັນຍາ" value={String(contracts.length)} />
              <Row label="ຈຳນວນ BOQ" value={String(boqs.length)} />
            </dl>
          )}
          {tab === "quotations" && (
            <MiniTable
              head={["ເລກທີ່", "ວັນທີ", "ມູນຄ່າ", "ສະຖານະ"]}
              rows={quotations.map((q) => [
                q.quotation_no || "-",
                (q.quotation_date ?? "").toString().slice(0, 10) || "-",
                money(q.total_amount),
                q.status || "-",
              ])}
              empty="ຍັງບໍ່ມີໃບສະເໜີລາຄາ"
            />
          )}
          {tab === "contracts" && (
            <MiniTable
              head={["ເລກສັນຍາ", "ຊື່", "ມູນຄ່າ", "ຝ່າຍຂາຍ", "ບັນຊີ", "BOQ"]}
              rows={contracts.map((c) => [
                c.contract_no || "-",
                c.contract_name || "-",
                money(c.amount ?? c.contract_value),
                Number(c.approve_status_1) === 1 ? "✓" : "—",
                Math.max(Number(c.approve_status_2) || 0, Number(c.acc_approve) || 0) === 1 ? "✓" : "—",
                c.has_boq || c.boq_status === "done" ? "✓" : "—",
              ])}
              empty="ຍັງບໍ່ມີສັນຍາ"
            />
          )}
          {tab === "boq" && (
            <MiniTable
              head={["BOQ ເລກທີ່", "ສັນຍາ", "ວັນທີ", "ສະຖານະ"]}
              rows={boqs.map((b) => [
                b.doc_no || "-",
                b.contract_no || "-",
                (b.doc_date ?? "").toString().slice(0, 10) || "-",
                Number(b.approve_status) === 1 ? "ອະນຸມັດ" : Number(b.approve_status) === 2 ? "ປະຕິເສດ" : "ລໍຖ້າ",
              ])}
              empty="ຍັງບໍ່ມີ BOQ"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--theme-border-subtle)] py-1.5">
      <dt className="text-[var(--theme-text-mute)]">{label}</dt>
      <dd className="text-right font-medium text-[var(--theme-text)]">{value || "-"}</dd>
    </div>
  );
}

function MiniTable({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (!rows.length) return <div className="py-8 text-center text-[12px] text-[var(--theme-text-mute)]">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--theme-border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--theme-border-subtle)] last:border-0 hover:bg-[var(--theme-bg-muted)]">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-1.5 text-[var(--theme-text)]">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
