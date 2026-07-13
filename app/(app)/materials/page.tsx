"use client";

/** Company-wide consolidated materials across all projects (ລວມວັດສະດຸ). */
import { useEffect, useMemo, useState } from "react";
import { Boxes, Loader2, RefreshCw, Search } from "lucide-react";
import { getAllMaterials, getProjectMaterials } from "@/_actions/boq-v2";
import { getProjects } from "@/_actions/projects";
import { Btn, Card, Page, PageHeader, Toolbar, tblCls, tdCls, thCls, trHover } from "../_components/ui";
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
      <PageHeader
        title={t("materials.title", "ລວມວັດສະດຸ (ທຸກໂຄງການ)")}
        subtitle={`${t("materials.subtitle", "ຍອດ BOQ ລວມ ທຽບກັບ ຂໍເບີກ / ເບີກແລ້ວ")} · ${filtered.length} ${t("materials.items", "ລາຍການ")}`}
        actions={
          <Btn variant="outline" onClick={() => void load(projectId)} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
          </Btn>
        }
      />

      <Toolbar>
        <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--text-mute)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("materials.search", "ຄົ້ນຫາ ລະຫັດ/ຊື່...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </label>
        <div className="w-64">
          <RSelect
            value={projectId}
            onChange={setProjectId}
            isClearable
            placeholder={t("materials.allProjects", "ທຸກໂຄງການ")}
            options={projects}
          />
        </div>
      </Toolbar>

      {loading ? (
        <Card className="flex h-48 items-center justify-center gap-2 text-[var(--text-mute)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[12.5px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="flex h-56 flex-col items-center justify-center gap-2 text-[var(--text-mute)]">
          <Boxes className="h-9 w-9 opacity-40" />
          <span className="text-[12.5px] font-semibold">{t("materials.empty", "ບໍ່ມີວັດສະດຸ")}</span>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={thCls}>{t("materials.col.item", "ລາຍການ")}</th>
                  <th className={`${thCls} w-20`}>{t("common.unit", "ໜ່ວຍ")}</th>
                  <th className={`${thCls} w-32 text-right`}>{t("materials.col.boq", "ຍອດ BOQ")}</th>
                  <th className={`${thCls} w-32 text-right`}>{t("materials.col.requested", "ຂໍເບີກ")}</th>
                  <th className={`${thCls} w-32 text-right`}>{t("materials.col.withdrawn", "ເບີກແລ້ວ")}</th>
                  <th className={`${thCls} w-32 text-right`}>{t("materials.col.remaining", "ຄົງເຫຼືອ")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className={trHover}>
                    <td className={tdCls}>
                      <div className="font-semibold text-[var(--text)]">{r.description || r.item_code || "-"}</div>
                      {r.item_code && <div className="mt-0.5 font-mono text-[10.5px] text-[var(--text-mute)]">{r.item_code}</div>}
                    </td>
                    <td className={`${tdCls} text-[var(--text-mute)]`}>{r.unit || "-"}</td>
                    <td className={`${tdCls} text-right font-mono tabular-nums`}>{n(r.boq_qty)}</td>
                    <td className={`${tdCls} text-right font-mono font-semibold tabular-nums text-[var(--warning)]`}>{n(r.request_qty)}</td>
                    <td className={`${tdCls} text-right font-mono font-semibold tabular-nums text-[var(--success)]`}>{n(r.withdraw_qty)}</td>
                    <td
                      className={`${tdCls} text-right font-mono font-bold tabular-nums ${
                        Number(r.remaining) > 0 ? "text-[var(--text)]" : "text-[var(--text-mute)]"
                      }`}
                    >
                      {n(r.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--surface-sunken)] font-bold">
                  <td className="border-t border-[var(--border)] px-4 py-3 text-[var(--text)]" colSpan={2}>
                    {t("common.total", "ລວມ")}
                  </td>
                  <td className="border-t border-[var(--border)] px-4 py-3 text-right font-mono tabular-nums text-[var(--text)]">{n(sum("boq_qty"))}</td>
                  <td className="border-t border-[var(--border)] px-4 py-3 text-right font-mono tabular-nums text-[var(--warning)]">{n(sum("request_qty"))}</td>
                  <td className="border-t border-[var(--border)] px-4 py-3 text-right font-mono tabular-nums text-[var(--success)]">{n(sum("withdraw_qty"))}</td>
                  <td className="border-t border-[var(--border)] px-4 py-3 text-right font-mono tabular-nums text-[var(--info)]">{n(sum("remaining"))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
