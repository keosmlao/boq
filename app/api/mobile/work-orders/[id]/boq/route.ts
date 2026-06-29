/** Mobile: a work order's project BOQ materials + the job's team (for ໃບຂໍເບີກ). */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { isManager } from "@/_lib/permissions";
import { query } from "@/_lib/db";
import { canWorkOnWo, loadWoRowPublic } from "@/_lib/workorder-core";
import { getProjectMaterials } from "@/_actions/boq-v2";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const wo = await loadWoRowPublic(String(id));
    if (!wo) return NextResponse.json({ error: "ບໍ່ພົບໃບງານ" }, { status: 404 });
    if (!isManager(user) && !(await canWorkOnWo(user, wo))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // BOQ materials for the project (BOQ-only requisition; show remaining).
    // The WO may store the project as its sml_code/project_code, but the BOQ is
    // keyed by odg_projects.id — resolve to the canonical id first (same as web).
    let items: any[] = [];
    let projectId = wo.project_id ? String(wo.project_id) : "";
    if (projectId) {
      try {
        const pr = await query(
          `SELECT id::text AS id FROM odg_projects WHERE id::text = $1 OR sml_code = $1 LIMIT 1`,
          [projectId],
        );
        if (pr.rows[0]?.id) projectId = String(pr.rows[0].id);
      } catch {/* fall back to the raw project_id */}
    }
    if (projectId) {
      const mat = await getProjectMaterials(projectId);
      if (mat.success) {
        items = mat.data
          .map((m: any) => ({
            item_code: m.item_code || "",
            description: m.description || "",
            unit: m.unit || "",
            boq_qty: Number(m.boq_qty) || 0,
            remaining: Number(m.remaining ?? m.available_qty) || 0,
          }))
          .filter((m: any) => m.description);
      }
    }

    // The job's team: head technician + their helpers (for the "ຜູ້ໃຊ້ວັດສະດຸ" selector).
    const team: Array<{ code: string; name: string }> = [];
    const lead = String(wo.technician_code || "").trim();
    if (lead) {
      const lr = await query(`SELECT code, name_1, helpers FROM odg_technicians WHERE code = $1 LIMIT 1`, [lead]);
      const row = lr.rows[0] as any;
      if (row) {
        team.push({ code: String(row.code), name: String(row.name_1 || row.code) });
        const codes = (Array.isArray(row.helpers) ? row.helpers : [])
          .map((h: any) => (h && typeof h === "object" ? (h.code ?? h.name_1 ?? h.name) : h))
          .map((h: any) => String(h || "").trim())
          .filter(Boolean);
        if (codes.length) {
          const hs = await query(`SELECT code, name_1 FROM odg_technicians WHERE code = ANY($1::text[])`, [codes]);
          for (const h of hs.rows as any[]) team.push({ code: String(h.code), name: String(h.name_1 || h.code) });
        }
      }
    }

    return NextResponse.json({ data: { items, team } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
