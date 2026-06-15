"use client";

/**
 * v2 projects — dense professional table (interactive shell).
 *
 * Data is fetched on the SERVER in page.tsx and passed in via `initialRows`,
 * so there is no mount→useEffect→server-action waterfall on navigation: the
 * rows are already present in the first render. The manual refresh button
 * still re-pulls via the server action on demand.
 */
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderOpen, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { getProjects } from "@/_actions/projects";
import { StatusBadge } from "@/_components/pipeline";
import { Page, thCls, tdCls } from "../_components/ui";

export default function ProjectsClient({ initialRows }: { initialRows: any[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>(initialRows ?? []);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      const status = String(r.project_status || "");
      if (statusFilter === "open" && status === "ປິດໂຄງການ") return false;
      if (statusFilter === "waiting" && !status.startsWith("ລໍຖ້າ")) return false;
      if (statusFilter === "closed" && status !== "ປິດໂຄງການ") return false;
      if (!kw) return true;
      return [r.project_name, r.customer_name, r.coordinator, r.sml_code, r.village_name, r.district_name, r.province_name, r.project_status]
        .map((x) => (x ?? "").toString().toLowerCase())
        .some((x) => x.includes(kw));
    });
  }, [rows, q, statusFilter]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [q, groupByCustomer, statusFilter]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / pageSize);

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((r) => {
      const cName = r.customer_name || r.sml_code || "(ບໍ່ລະບຸລູກຄ້າ)";
      if (!groups[cName]) groups[cName] = [];
      groups[cName].push(r);
    });
    return Object.entries(groups).map(([customerName, projects]) => ({
      customerName,
      projects,
    }));
  }, [filtered]);

  const runningCount = rows.filter((r) =>
    ["running", "ດຳເນີນຕາມໂຄງການ", "ໃບງານ"].includes(r.project_status)
  ).length;

  const quoteCount = rows.filter((r) =>
    ["quotation", "ສະເໜີລາຄາ"].includes(r.project_status)
  ).length;

  return (
    <Page max="max-w-none w-full">
      {/* Monochrome Minimalist Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="min-w-0">
          <h1 className="truncate text-xl md:text-2xl font-bold tracking-tight text-slate-900 leading-none">ໂຄງການ</h1>
          <p className="mt-2 text-xs font-medium text-slate-400">
            ໂຄງການທັງໝົດ {rows.length} · ກຳລັງດຳເນີນການ {runningCount} · ສະເໜີລາຄາ / Pre-Sales {quoteCount}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => router.push("/projects/new")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 active:scale-[0.98] cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} /> ລົງທະບຽນໂຄງການ
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Search & Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ຄົ້ນຫາໂຄງການ, ລູກຄ້າ..."
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              {[
                ["all", "ທັງໝົດ"],
                ["open", "ກຳລັງເຮັດ"],
                ["waiting", "ລໍຖ້າ"],
                ["closed", "ປິດແລ້ວ"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === key
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setGroupByCustomer(!groupByCustomer)}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold border transition-all cursor-pointer ${
              groupByCustomer
                ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>ຈັດກຸ່ມຕາມລູກຄ້າ</span>
          </button>
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center gap-3 text-slate-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
            <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <FolderOpen className="h-8 w-8 opacity-40" />
            <span className="text-sm font-semibold">ບໍ່ພົບໂຄງການ</span>
          </div>
        ) : groupByCustomer ? (
          /* Grouped by Customer View */
          <div className="space-y-5">
            {grouped.map((g, gi) => (
              <div key={gi} className="border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-2xs">
                {/* Customer Group Header */}
                <div className="bg-slate-50 px-4.5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-slate-100 border border-slate-200/50 font-bold text-xs text-slate-600">
                      {g.customerName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[13px] font-bold text-slate-800">{g.customerName}</span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {g.projects.length} ໂຄງການ
                  </span>
                </div>

                {/* Projects under this customer */}
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-xs">
                    <thead>
                      <tr className="bg-slate-50/55">
                        <th className={`${thCls} w-12 pl-4.5 border-b border-slate-100 bg-slate-50/50`}>#</th>
                        <th className={`${thCls} border-b border-slate-100 bg-slate-50/50`}>ໂຄງການ</th>
                        <th className={`${thCls} hidden lg:table-cell border-b border-slate-100 bg-slate-50/50`}>ສະຖານທີ່</th>
                        <th className={`${thCls} border-b border-slate-100 bg-slate-50/50`}>ສະຖານະ</th>
                        <th className={`${thCls} w-10 pr-4.5 border-b border-slate-100 bg-slate-50/50`} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {g.projects.map((r, pi) => (
                        <tr
                          key={r.id ?? pi}
                          onClick={() => router.push(`/projects/${encodeURIComponent(String(r.id))}`)}
                          className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        >
                          <td className={`${tdCls} pl-4.5 text-[11px] font-mono text-slate-400`}>
                            {String(pi + 1).padStart(2, "0")}
                          </td>
                          <td className={`${tdCls} font-semibold text-slate-700`}>
                            <div className="flex items-center gap-2.5">
                              <Thumb url={r.image_url} name={r.project_name} />
                              <span>{r.project_name || "(ບໍ່ມີຊື່)"}</span>
                            </div>
                          </td>
                          <td className={`${tdCls} hidden text-slate-500 lg:table-cell`}>
                            {[r.village_name, r.district_name, r.province_name].filter(Boolean).join(", ") || "-"}
                          </td>
                          <td className={tdCls}>
                            <StatusBadge status={r.project_status} />
                          </td>
                          <td className={`${tdCls} pr-4.5 text-right`}>
                            <ChevronRight className="inline-block h-4 w-4 text-slate-300" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat Paginated View */
          <div className="border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-xs">
                <thead>
                  <tr className="bg-slate-50/55">
                    <th className={`${thCls} w-12 pl-4.5 border-b border-slate-100 bg-slate-50/50`}>#</th>
                    <th className={`${thCls} border-b border-slate-100 bg-slate-50/50`}>ໂຄງການ</th>
                    <th className={`${thCls} hidden md:table-cell border-b border-slate-100 bg-slate-50/50`}>ຊື່ລູກຄ້າ</th>
                    <th className={`${thCls} hidden lg:table-cell border-b border-slate-100 bg-slate-50/50`}>ສະຖານທີ່</th>
                    <th className={`${thCls} border-b border-slate-100 bg-slate-50/50`}>ສະຖານະ</th>
                    <th className={`${thCls} w-10 pr-4.5 border-b border-slate-100 bg-slate-50/50`} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginated.map((r, i) => (
                    <tr
                      key={r.id ?? i}
                      onClick={() => router.push(`/projects/${encodeURIComponent(String(r.id))}`)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <td className={`${tdCls} pl-4.5 text-[11px] font-mono text-slate-400`}>
                        {String((currentPage - 1) * pageSize + i + 1).padStart(2, "0")}
                      </td>
                      <td className={`${tdCls} font-semibold text-slate-700`}>
                        <div className="flex items-center gap-2.5">
                          <Thumb url={r.image_url} name={r.project_name} />
                          <span>{r.project_name || "(ບໍ່ມີຊື່)"}</span>
                        </div>
                      </td>
                      <td className={`${tdCls} hidden text-slate-500 md:table-cell`}>
                        {r.customer_name || r.sml_code || "-"}
                      </td>
                      <td className={`${tdCls} hidden text-slate-500 lg:table-cell`}>
                        {[r.village_name, r.district_name, r.province_name].filter(Boolean).join(", ") || "-"}
                      </td>
                      <td className={tdCls}>
                        <StatusBadge status={r.project_status} />
                      </td>
                      <td className={`${tdCls} pr-4.5 text-right`}>
                        <ChevronRight className="inline-block h-4 w-4 text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filtered.length > pageSize && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/20 gap-3">
                <div className="text-[11px] text-slate-400 font-medium">
                  ສະແດງ {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filtered.length)} ຈາກ {filtered.length} ໂຄງການ
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                  >
                    ກ່ອນໜ້າ
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pNum = idx + 1;
                      if (totalPages > 5 && Math.abs(pNum - currentPage) > 1 && pNum !== 1 && pNum !== totalPages) {
                        if (pNum === 2 || pNum === totalPages - 1) {
                          return <span key={idx} className="px-1 text-slate-400 text-xs">...</span>;
                        }
                        return null;
                      }
                      return (
                        <button
                          key={idx}
                          onClick={() => setCurrentPage(pNum)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-semibold transition-all shadow-2xs cursor-pointer ${
                            currentPage === pNum
                              ? "bg-blue-600 text-white shadow-xs"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                  >
                    ຖັດໄປ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

function Thumb({ url, name }: { url?: string | null; name?: string }) {
  const [err, setErr] = useState(false);
  if (url && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        onError={() => setErr(true)}
        className="h-7 w-7 flex-shrink-0 rounded object-cover ring-1 ring-slate-200/60"
      />
    );
  }
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-600">
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}
