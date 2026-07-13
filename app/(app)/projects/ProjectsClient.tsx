"use client";

/**
 * ໂຄງການ — flat list (ODIEN SERVICE layout): toolbar → status tabs → one table.
 * Rows carry a status bar down the left edge. Board and map views are kept.
 *
 * Data is fetched on the SERVER in page.tsx and passed in via `initialRows`,
 * so there is no mount→useEffect→server-action waterfall on navigation: the
 * rows are already present in the first render. The manual refresh button
 * still re-pulls via the server action on demand.
 */
import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutGrid,
  Loader2,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Search,
  Table as TableIcon,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import RSelect from "../_components/RSelect";
import {
  Btn,
  BtnCount,
  Card,
  Page,
  PageHeader,
  Pill,
  RowBar,
  RowBarTh,
  Segmented,
  SortTh,
  Toolbar,
  TwoLine,
  tblCls,
  tdCls,
  thCls,
  trHover,
  type PillTone,
} from "../_components/ui";
import { getProjects } from "@/_actions/projects";
import { getInstallTracking, type InstallRow } from "@/_actions/install-tracking";
import { useT } from "@/_lib/i18n";

const ProjectsMap = dynamic(() => import("./ProjectsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-mute)]">
      <Loader2 size={22} className="animate-spin" />
    </div>
  ),
});

const PER_PAGE = 25;

const fmtD = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");
const daysSince = (v?: string | null) => (v ? Math.max(0, Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000)) : null);

type SortKey = "project_name" | "customer_name" | "project_status" | "install_started_at" | "wo_count" | "worked_hours";
type ViewMode = "table" | "board" | "map";

/** Stage of a single project row — mirrors the status filter semantics below. */
function stageOf(r: any): "waiting" | "closed" | "open" {
  const status = String(r.project_status || "");
  if (status === "ປິດໂຄງການ") return "closed";
  if (status.startsWith("ລໍຖ້າ")) return "waiting";
  return "open";
}

/**
 * The status filter predicate. NOTE: "open" means "not closed" (it therefore
 * also contains the waiting projects) — this is the pre-existing behaviour and
 * is deliberately preserved.
 */
function matchesStatus(r: any, key: string): boolean {
  const status = String(r.project_status || "");
  if (key === "open") return status !== "ປິດໂຄງການ";
  if (key === "waiting") return status.startsWith("ລໍຖ້າ");
  if (key === "closed") return status === "ປິດໂຄງການ";
  return true;
}

const STAGE_BAR: Record<string, "info" | "brand" | "warning" | "success" | "danger" | "neutral"> = {
  open: "brand",
  waiting: "warning",
  closed: "success",
};

const STAGE_PILL: Record<string, PillTone> = {
  open: "brand",
  waiting: "amber",
  closed: "green",
};

export default function ProjectsClient({
  initialRows,
  initialView = "table",
}: {
  initialRows: any[];
  initialView?: "table" | "map";
}) {
  const router = useRouter();
  const t = useT();
  const [rows, setRows] = useState<any[]>(initialRows ?? []);
  const [metrics, setMetrics] = useState<Map<string, InstallRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [draftQ, setDraftQ] = useState("");
  const [q, setQ] = useState("");
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "project_name", dir: "asc" });

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await getProjects({ summary: true });
      setRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    getInstallTracking().then((r: any) => {
      if (r?.success) setMetrics(new Map((r.data as InstallRow[]).map((x) => [x.project_id, x])));
    });
  }, []);

  const runSearch = () => {
    setQ(draftQ);
    setCurrentPage(1);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const key of ["open", "waiting", "closed"]) c[key] = rows.filter((r) => matchesStatus(r, key)).length;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (!matchesStatus(r, statusFilter)) return false;
      if (!kw) return true;
      return [r.project_name, r.customer_name, r.coordinator, r.sml_code, r.village_name, r.district_name, r.province_name, r.project_status]
        .map((x) => (x ?? "").toString().toLowerCase())
        .some((x) => x.includes(kw));
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    const num = (r: any, key: "wo_count" | "worked_hours") => Number(metrics.get(String(r.id))?.[key] ?? 0) || 0;
    return [...list].sort((a, b) => {
      if (sort.key === "wo_count" || sort.key === "worked_hours") {
        return num(a, sort.key) > num(b, sort.key) ? dir : -dir;
      }
      const av =
        sort.key === "install_started_at" ? metrics.get(String(a.id))?.install_started_at ?? "" : a[sort.key];
      const bv =
        sort.key === "install_started_at" ? metrics.get(String(b.id))?.install_started_at ?? "" : b[sort.key];
      return String(av ?? "") > String(bv ?? "") ? dir : -dir;
    });
  }, [rows, q, statusFilter, sort, metrics]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [q, groupByCustomer, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(currentPage, totalPages);
  const paginated = useMemo(
    () => filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE),
    [filtered, current],
  );

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((r) => {
      const cName = r.customer_name || r.sml_code || t("projects.noCustomer", "(ບໍ່ລະບຸລູກຄ້າ)");
      if (!groups[cName]) groups[cName] = [];
      groups[cName].push(r);
    });
    return Object.entries(groups).map(([customerName, projects]) => ({ customerName, projects }));
  }, [filtered, t]);

  const stages = [
    { value: "all", label: t("common.all", "ທັງໝົດ") },
    { value: "open", label: t("projects.filter.open", "ກຳລັງເຮັດ") },
    { value: "waiting", label: t("projects.filter.waiting", "ລໍຖ້າ") },
    { value: "closed", label: t("projects.filter.closed", "ປິດແລ້ວ") },
  ];

  const stageLabel = (key: string) => stages.find((s) => s.value === key)?.label ?? key;

  const tabs = stages.map((tab) => ({
    value: tab.value,
    label: (
      <span className="flex items-center gap-1.5">
        {tab.label}
        <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-black dark:bg-white/15">{counts[tab.value] ?? 0}</span>
      </span>
    ),
  }));

  /** Excel export of exactly what is on screen (current filter + sort, all pages). */
  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      filtered.map((r) => {
        const m = metrics.get(String(r.id));
        const dur = daysSince(m?.install_started_at);
        return {
          [t("projects.col.project", "ໂຄງການ")]: r.project_name || "",
          [t("projects.col.customerName", "ຊື່ລູກຄ້າ")]: r.customer_name || r.sml_code || "",
          [t("common.status", "ສະຖານະ")]: r.project_status || "",
          [t("projects.col.installStart", "ເລີ່ມຕິດຕັ້ງ")]: fmtD(m?.install_started_at),
          [t("projects.col.duration", "ໄລຍະ")]: dur ?? "",
          [t("projects.col.workOrders", "ໃບງານ")]: m?.wo_count ?? 0,
          [t("projects.col.hours", "ຊົ່ວໂມງ")]: m && m.worked_hours > 0 ? Number(m.worked_hours.toFixed(1)) : 0,
        };
      }),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "projects");
    XLSX.writeFile(book, `projects-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const openProject = (id: unknown) => router.push(`/projects/${encodeURIComponent(String(id))}`);

  /** The shared table body for both the flat and the grouped-by-customer views. */
  const renderRows = (list: any[]) =>
    list.map((r, i) => {
      const m = metrics.get(String(r.id));
      const dur = daysSince(m?.install_started_at);
      const stage = stageOf(r);
      return (
        <tr key={r.id ?? i} onClick={() => openProject(r.id)} className={`${trHover} cursor-pointer`}>
          <RowBar tone={STAGE_BAR[stage] || "neutral"} />
          <td className={tdCls}>
            <TwoLine
              primary={r.project_name || t("projects.noName", "(ບໍ່ມີຊື່)")}
              secondary={r.customer_name || r.sml_code || undefined}
            />
          </td>
          <td className={tdCls}>
            <Pill tone={STAGE_PILL[stage] || "neutral"}>{r.project_status || stageLabel(stage)}</Pill>
          </td>
          <td className={`${tdCls} tabular-nums`}>{fmtD(m?.install_started_at)}</td>
          <td className={`${tdCls} text-right tabular-nums`}>
            {dur != null ? `${dur} ${t("projects.unit.days", "ມື້")}` : "—"}
          </td>
          <td className={`${tdCls} text-right tabular-nums`}>{m?.wo_count ? m.wo_count : "—"}</td>
          <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>
            {m && m.worked_hours > 0 ? m.worked_hours.toFixed(1) : "—"}
          </td>
        </tr>
      );
    });

  const head = (
    <thead>
      <tr>
        <RowBarTh />
        <SortTh
          label={t("projects.col.project", "ໂຄງການ")}
          active={sort.key === "project_name"}
          dir={sort.dir}
          onClick={() => toggleSort("project_name")}
        />
        <SortTh
          label={t("common.status", "ສະຖານະ")}
          active={sort.key === "project_status"}
          dir={sort.dir}
          onClick={() => toggleSort("project_status")}
          className="w-44"
        />
        <SortTh
          label={t("projects.col.installStart", "ເລີ່ມຕິດຕັ້ງ")}
          active={sort.key === "install_started_at"}
          dir={sort.dir}
          onClick={() => toggleSort("install_started_at")}
          className="w-32"
        />
        <th className={`${thCls} w-24 text-right`}>{t("projects.col.duration", "ໄລຍະ")}</th>
        <SortTh
          label={t("projects.col.workOrders", "ໃບງານ")}
          active={sort.key === "wo_count"}
          dir={sort.dir}
          onClick={() => toggleSort("wo_count")}
          className="w-24 text-right"
        />
        <SortTh
          label={t("projects.col.hours", "ຊົ່ວໂມງ")}
          active={sort.key === "worked_hours"}
          dir={sort.dir}
          onClick={() => toggleSort("worked_hours")}
          className="w-24 text-right"
        />
      </tr>
    </thead>
  );

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("projects.title", "ໂຄງການ")}
        subtitle={`${t("projects.summary.total", "ໂຄງການທັງໝົດ")} ${filtered.length} · ${t("common.page", "ໜ້າ")} ${current}/${totalPages}`}
        actions={
          <>
            <Btn variant="go" onClick={() => router.push("/projects/new")}>
              <Plus size={14} /> {t("projects.register", "ລົງທະບຽນໂຄງການ")}
            </Btn>
            <Btn variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
              <FileSpreadsheet size={14} /> Excel
            </Btn>
            <Btn variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
            </Btn>
            <Btn
              variant="danger-outline"
              onClick={() => {
                setStatusFilter("waiting");
                setCurrentPage(1);
              }}
            >
              <BellRing size={14} /> {t("projects.filter.waiting", "ລໍຖ້າ")} <BtnCount value={counts.waiting ?? 0} />
            </Btn>
          </>
        }
      />

      <Toolbar>
        <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--text-mute)]" />
          <input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder={t("projects.search.placeholder", "ຄົ້ນຫາໂຄງການ, ລູກຄ້າ...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </label>

        <div className="w-52">
          <RSelect
            value={statusFilter === "all" ? "" : statusFilter}
            onChange={(v) => {
              setStatusFilter(v || "all");
              setCurrentPage(1);
            }}
            isClearable
            isSearchable={false}
            placeholder={t("projects.allStatuses", "ສະຖານະທັງໝົດ")}
            options={stages
              .filter((s) => s.value !== "all")
              .map((s) => ({ value: s.value, label: `${s.label} (${counts[s.value] ?? 0})` }))}
          />
        </div>

        <Btn variant="ink" onClick={runSearch}>
          <Search size={14} /> {t("common.search", "ຄົ້ນຫາ")}
        </Btn>

        <Btn
          variant={groupByCustomer ? "primary" : "outline"}
          onClick={() => setGroupByCustomer(!groupByCustomer)}
          disabled={viewMode !== "table"}
        >
          <Users size={14} /> {t("projects.groupByCustomer", "ຈັດກຸ່ມຕາມລູກຄ້າ")}
        </Btn>

        <Segmented<ViewMode>
          className="ml-auto"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: "table", label: t("projects.view.table", "ຕາຕະລາງ"), icon: <TableIcon size={14} /> },
            { value: "board", label: t("projects.view.board", "ກະດານ"), icon: <LayoutGrid size={14} /> },
            { value: "map", label: t("projects.view.map", "ແຜນທີ່"), icon: <MapIcon size={14} /> },
          ]}
        />
      </Toolbar>

      <div className="mb-4 overflow-x-auto">
        <Segmented
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setCurrentPage(1);
          }}
          options={tabs}
        />
      </div>

      {loading ? (
        <Card className="flex h-56 items-center justify-center gap-3 text-[var(--text-mute)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-[12.5px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
        </Card>
      ) : viewMode === "map" ? (
        <ProjectsMap rows={filtered} onOpen={(id) => openProject(id)} t={t} />
      ) : viewMode === "board" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stages
            .filter((s) => s.value !== "all")
            .map((s) => {
              const col = filtered.filter((r) => matchesStatus(r, s.value));
              return (
                <Card key={s.value} className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-3 py-2">
                    <Pill tone={STAGE_PILL[s.value] || "neutral"}>{s.label}</Pill>
                    <span className="text-[11px] font-bold text-[var(--text-mute)]">{col.length}</span>
                  </div>
                  <div className="max-h-[520px] space-y-1.5 overflow-y-auto p-2">
                    {col.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-[var(--text-mute)]">{t("projects.notFound", "ບໍ່ພົບໂຄງການ")}</p>
                    ) : (
                      col.map((r) => (
                        <button
                          key={String(r.id)}
                          type="button"
                          onClick={() => openProject(r.id)}
                          className="flex w-full items-start gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                        >
                          <span
                            className="mt-0.5 h-8 w-[3px] flex-shrink-0 rounded-full"
                            style={{ background: `var(--${STAGE_BAR[stageOf(r)] || "border-strong"})` }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11.5px] font-semibold text-[var(--text)]">
                              {r.project_name || t("projects.noName", "(ບໍ່ມີຊື່)")}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--text-soft)]">
                              {r.customer_name || r.sml_code || "-"}
                            </span>
                            <span className="block truncate text-[10px] text-[var(--text-mute)]">{r.project_status || "-"}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </Card>
              );
            })}
        </div>
      ) : groupByCustomer ? (
        <div className="space-y-4">
          {grouped.length === 0 ? (
            <Card className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
              {t("projects.notFound", "ບໍ່ພົບໂຄງການ")}
            </Card>
          ) : (
            grouped.map((g, gi) => (
              <Card key={gi} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px] font-black text-[var(--text-soft)]">
                      {g.customerName.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[12.5px] font-bold text-[var(--text)]">{g.customerName}</span>
                  </div>
                  <span className="text-[11px] font-bold text-[var(--text-mute)]">
                    {g.projects.length} {t("projects.unit", "ໂຄງການ")}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className={tblCls}>
                    {head}
                    <tbody>{renderRows(g.projects)}</tbody>
                  </table>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className={tblCls}>
              {head}
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]`}>
                      {t("projects.notFound", "ບໍ່ພົບໂຄງການ")}
                    </td>
                  </tr>
                ) : (
                  renderRows(paginated)
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--border-soft)] px-4 py-2.5">
              <span className="text-[11.5px] text-[var(--text-mute)]">
                {t("common.page", "ໜ້າ")} {current}/{totalPages}
              </span>
              <div className="flex gap-1.5">
                <Btn variant="outline" onClick={() => setCurrentPage(current - 1)} disabled={current <= 1}>
                  <ChevronLeft size={14} /> {t("common.prev", "ກ່ອນ")}
                </Btn>
                <Btn variant="outline" onClick={() => setCurrentPage(current + 1)} disabled={current >= totalPages}>
                  {t("common.next", "ຖັດໄປ")} <ChevronRight size={14} />
                </Btn>
              </div>
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}
