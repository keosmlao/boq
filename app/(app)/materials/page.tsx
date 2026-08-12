"use client";

/** Company-wide consolidated materials across all projects (ລວມວັດສະດຸ). */
import { useEffect, useMemo, useState } from "react";
import { Boxes, Loader2, RefreshCw, Search } from "lucide-react";
import { getAllMaterials, getProjectMaterials } from "@/_actions/boq-v2";
import { getProjects } from "@/_actions/projects";
import { Btn, Card, Page, PageHeader, RowBar, RowBarTh, SortTh, Toolbar, TwoLine, tblCls, tdCls, thCls, trHover } from "../_components/ui";
import RSelect from "../_components/RSelect";
import { useT } from "@/_lib/i18n";

const n = (v: unknown) => (Number(v) || 0).toLocaleString("en-US");

type SortKey = "description" | "boq_qty" | "request_qty" | "withdraw_qty" | "remaining";

/** Left-edge bar (ODS list): where the BOQ line stands — drawn down, out, or open. */
const barTone = (r: any): "neutral" | "success" | "warning" | "info" => {
  if ((Number(r.remaining) || 0) <= 0) return "neutral";
  if ((Number(r.withdraw_qty) || 0) > 0) return "success";
  if ((Number(r.request_qty) || 0) > 0) return "warning";
  return "info";
};

export default function MaterialsPage() {
  const t = useT();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState(""); // "" = all projects
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "description", dir: "asc" });
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
    const list = kw
      ? rows.filter((r) => [r.description, r.item_code].some((x) => String(x || "").toLowerCase().includes(kw)))
      : rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "description") return String(a.description || a.item_code || "").localeCompare(String(b.description || b.item_code || "")) * dir;
      return ((Number(a[sort.key]) || 0) - (Number(b[sort.key]) || 0)) * dir;
    });
  }, [rows, q, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

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
        <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3">
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
                  <RowBarTh />
                  <SortTh
                    label={t("materials.col.item", "ລາຍການ")}
                    active={sort.key === "description"}
                    dir={sort.dir}
                    onClick={() => toggleSort("description")}
                  />
                  <th className={`${thCls} w-20`}>{t("common.unit", "ໜ່ວຍ")}</th>
                  <SortTh
                    label={t("materials.col.boq", "ຍອດ BOQ")}
                    active={sort.key === "boq_qty"}
                    dir={sort.dir}
                    onClick={() => toggleSort("boq_qty")}
                    className="w-32 text-right"
                  />
                  <SortTh
                    label={t("materials.col.requested", "ຂໍເບີກ")}
                    active={sort.key === "request_qty"}
                    dir={sort.dir}
                    onClick={() => toggleSort("request_qty")}
                    className="w-32 text-right"
                  />
                  <SortTh
                    label={t("materials.col.withdrawn", "ເບີກແລ້ວ")}
                    active={sort.key === "withdraw_qty"}
                    dir={sort.dir}
                    onClick={() => toggleSort("withdraw_qty")}
                    className="w-32 text-right"
                  />
                  <SortTh
                    label={t("materials.col.remaining", "ຄົງເຫຼືອ")}
                    active={sort.key === "remaining"}
                    dir={sort.dir}
                    onClick={() => toggleSort("remaining")}
                    className="w-32 text-right"
                  />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className={trHover}>
                    <RowBar tone={barTone(r)} />
                    <td className={tdCls}>
                      <TwoLine
                        primary={r.description || r.item_code || "-"}
                        secondary={r.item_code ? <span className="font-mono">{r.item_code}</span> : undefined}
                      />
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
                  <td className="border-t border-[var(--border)] p-0" />
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
