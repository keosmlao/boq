"use client";

/** Company-wide consolidated materials across all projects (ລວມວັດສະດຸ). */
import { useEffect, useMemo, useState } from "react";
import { Boxes, RefreshCw, Search } from "lucide-react";
import { getAllMaterials, getProjectMaterials } from "@/_actions/boq-v2";
import { getProjects } from "@/_actions/projects";
import { Page } from "../_components/ui";
import RSelect from "../_components/RSelect";
import { useT } from "@/_lib/i18n";

const n = (v: unknown) => (Number(v) || 0).toLocaleString("en-US");

export default function MaterialsPage() {
  const t = useT();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState(""); // "" = all projects
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);

  // Load the project list once for the filter.
  useEffect(() => {
    getProjects({ summary: true }).then((res: any) => {
      const data = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
      setProjects(data.map((p: any) => ({ value: String(p.id), label: p.project_name || p.sml_code || `#${p.id}` })));
    }).catch(() => {});
  }, []);

  const load = async (pid: string) => {
    setLoading(true);
    try {
      const res: any = pid ? await getProjectMaterials(pid) : await getAllMaterials();
      setRows(res?.success ? res.data || [] : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(projectId); }, [projectId]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) => [r.description, r.item_code].some((x) => String(x || "").toLowerCase().includes(kw)));
  }, [rows, q]);

  const sum = (k: string) => filtered.reduce((s, r) => s + (Number(r[k]) || 0), 0);

  return (
    <Page max="max-w-none w-full">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("materials.title", "ລວມວັດສະດຸ (ທຸກໂຄງການ)")}</h1>
          <p className="mt-1 text-xs font-medium text-slate-400">{t("materials.subtitle", "ຍອດ BOQ ລວມ ທຽບກັບ ຂໍເບີກ / ເບີກແລ້ວ")} · {filtered.length} {t("materials.items", "ລາຍການ")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-60">
            <RSelect
              value={projectId}
              onChange={setProjectId}
              isClearable
              placeholder={t("materials.allProjects", "ທຸກໂຄງການ")}
              options={projects}
            />
          </div>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5">
            <Search size={14} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("materials.search", "ຄົ້ນຫາ ລະຫັດ/ຊື່...")} className="w-48 bg-transparent text-xs font-semibold outline-none" />
          </div>
          <button onClick={() => void load(projectId)} disabled={loading} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-400">
          <Boxes className="h-9 w-9 opacity-40" />
          <span className="text-sm font-semibold">{t("materials.empty", "ບໍ່ມີວັດສະດຸ")}</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">{t("materials.col.item", "ລາຍການ")}</th>
                <th className="px-4 py-3 text-left">{t("common.unit", "ໜ່ວຍ")}</th>
                <th className="px-4 py-3 text-right">{t("materials.col.boq", "ຍອດ BOQ")}</th>
                <th className="px-4 py-3 text-right">{t("materials.col.requested", "ຂໍເບີກ")}</th>
                <th className="px-4 py-3 text-right">{t("materials.col.withdrawn", "ເບີກແລ້ວ")}</th>
                <th className="px-4 py-3 text-right">{t("materials.col.remaining", "ຄົງເຫຼືອ")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-bold text-slate-900">
                    <div>{r.description || r.item_code || "-"}</div>
                    {r.item_code && <div className="mt-0.5 font-mono text-[10.5px] font-medium text-slate-400">{r.item_code}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{r.unit || "-"}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">{n(r.boq_qty)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-amber-600">{n(r.request_qty)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-600">{n(r.withdraw_qty)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold ${Number(r.remaining) > 0 ? "text-slate-900" : "text-slate-400"}`}>{n(r.remaining)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60 font-bold">
                <td className="px-4 py-3 text-slate-900" colSpan={2}>{t("common.total", "ລວມ")}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-700">{n(sum("boq_qty"))}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-600">{n(sum("request_qty"))}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600">{n(sum("withdraw_qty"))}</td>
                <td className="px-4 py-3 text-right font-mono text-blue-600">{n(sum("remaining"))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Page>
  );
}
