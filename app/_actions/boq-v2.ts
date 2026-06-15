"use server";

import { query } from "@/_lib/db";
import { num } from "@/_lib/schemas/boq";
import { ensureRequestSchema } from "@/_lib/schemas/request";

type Fail = { success: false; message: string };
function fail(message: string): Fail {
  return { success: false, message };
}

/**
 * All BOQs for the cross-project list — sourced from the ERP BOQ tables
 * (odg_projects_boq via getListBoq). requester/approver are resolved to
 * employee names inside getListBoq.
 */
export async function getAllBoqsForList(): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const result = await query(`
      SELECT
        b.roworder AS id,
        b.doc_no,
        b.doc_date,
        b.cust_code,
        b.project_id,
        COALESCE(euc.fullname_lo, b.user_created) AS user_created,
        COALESCE(b.approve_status, 0)::int AS approve_status,
        COALESCE(eap.fullname_lo, b.approver) AS approver,
        p.project_name,
        c.contract_no
      FROM odg_projects_boq b
      LEFT JOIN odg_projects p
        ON p.id::text = b.project_id::text
      LEFT JOIN odg_projects_contract c
        ON c.roworder = b.contract_id
      LEFT JOIN odg_employee euc
        ON euc.employee_code = b.user_created
      LEFT JOIN odg_employee eap
        ON eap.employee_code = b.approver
      ORDER BY b.doc_date DESC NULLS LAST, b.roworder DESC
    `);

    const rows: any[] = result.rows.map((r: any) => {
      const st = Number(r.approve_status);
      return {
        id: r.id,
        boq_no: r.doc_no,
        project_name: r.project_name || r.contract_no || null,
        customer_name: r.cust_code || null,
        total_amount: null,
        subtotal: null,
        status: st === 1 ? "ອະນຸມັດແລ້ວ" : st === 2 ? "ປະຕິເສດ" : "ລໍຖ້າອະນຸມັດ",
        requester: r.user_created || null,
        approver: r.approver || null,
        project_id: r.project_id != null ? String(r.project_id) : "",
        created_at: r.doc_date,
        src: "erp",
      };
    });
    return { success: true, data: rows };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Consolidated materials for a project — sums BOQ items across ALL its ERP BOQs
 * (odg_projects_boq_detail), with requested / withdrawn and remaining.
 */
export async function getProjectMaterials(projectId: string): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const map = new Map<string, any>();
    const keyOf = (code: any, desc: any) => String(code || "").trim() || String(desc || "").trim().toLowerCase();
    const add = (code: any, desc: any, unit: any, qty: any) => {
      const k = keyOf(code, desc);
      if (!k) return;
      const e = map.get(k) || { item_code: code || "", description: desc || "", unit: unit || "", boq_qty: 0, request_qty: 0, withdraw_qty: 0 };
      e.boq_qty += num(qty);
      if (!e.unit && unit) e.unit = unit;
      if (!e.description && desc) e.description = desc;
      map.set(k, e);
    };

    // ERP BOQs + requests/withdrawals
    try {
      const lb = await query(`SELECT doc_no FROM odg_projects_boq WHERE project_id::text = $1`, [String(projectId)]);
      const docNos = (lb.rows as any[]).map((r) => r.doc_no).filter(Boolean);
      if (docNos.length) {
        const ld = await query(
          `SELECT item_code, item_name, unit_code, SUM(qty)::numeric AS qty
           FROM odg_projects_boq_detail WHERE doc_no = ANY($1::text[])
           GROUP BY item_code, item_name, unit_code`,
          [docNos],
        );
        for (const r of ld.rows as any[]) add(r.item_code, r.item_name, r.unit_code, r.qty);

        const rq = await query(
          `SELECT d.item_code,
                  SUM(CASE WHEN COALESCE(r.doc_success,0)=0 THEN d.qty ELSE 0 END)::numeric AS req,
                  SUM(CASE WHEN COALESCE(r.doc_success,0)=1 THEN d.qty ELSE 0 END)::numeric AS wd
           FROM odg_requests r JOIN odg_requests_detail d ON d.doc_no = r.doc_no
           WHERE r.doc_ref = ANY($1::text[]) GROUP BY d.item_code`,
          [docNos],
        );
        for (const r of rq.rows as any[]) {
          const e = map.get(keyOf(r.item_code, ""));
          if (e) {
            e.request_qty += num(r.req);
            e.withdraw_qty += num(r.wd);
          }
        }
      }
    } catch (e) {
      // Legacy tables/columns differ — totals still returned, but log so a real
      // DB error doesn't silently produce wrong "remaining" quantities.
      console.error("getProjectMaterials: ERP BOQ/requests read failed:", e);
    }

    // v2 requests (ຂໍເບີກ): requested → request_qty, withdrawn → withdraw_qty.
    try {
      await ensureRequestSchema();
      const reqs = await query(
        `SELECT status, items FROM odg_request WHERE project_id = $1 AND COALESCE(status,'') <> 'rejected'`,
        [String(projectId)],
      );
      for (const r of reqs.rows as any[]) {
        const withdrawn = r.status === "withdrawn";
        for (const it of Array.isArray(r.items) ? r.items : []) {
          const e = map.get(keyOf(it.item_code, it.description));
          if (!e) continue;
          if (withdrawn) e.withdraw_qty += num(it.qty);
          else e.request_qty += num(it.qty);
        }
      }
    } catch (e) {
      // v2 request table not ready — totals still returned, but log it.
      console.error("getProjectMaterials: v2 request read failed:", e);
    }

    const data = Array.from(map.values()).map((e) => ({
      ...e,
      remaining: Math.max(num(e.boq_qty) - num(e.request_qty) - num(e.withdraw_qty), 0),
    }));
    data.sort((a, b) => String(a.description).localeCompare(String(b.description)));
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
}
