"use server";

import { query } from "@/_lib/db";
import { num } from "@/_lib/schemas/boq";
import { ensureRequestSchema } from "@/_lib/schemas/request";

type Fail = { success: false; message: string };
function fail(message: string): Fail {
  return { success: false, message };
}

/**
 * Company-wide consolidated materials — sums BOQ across ALL projects with the
 * requested / withdrawn totals from v2 requests. Powers the global "ລວມວັດສະດຸ"
 * page so procurement can see total demand in one place.
 */
export async function getAllMaterials(): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const map = new Map<string, any>();
    const keyOf = (code: any, desc: any) => String(code || "").trim() || String(desc || "").trim().toLowerCase();

    // BOQ totals across every project's BOQ details.
    try {
      const ld = await query(
        `SELECT item_code, item_name, unit_code, SUM(qty)::numeric AS qty
         FROM odg_projects_boq_detail
         GROUP BY item_code, item_name, unit_code`,
      );
      for (const r of ld.rows as any[]) {
        const k = keyOf(r.item_code, r.item_name);
        if (!k) continue;
        const e = map.get(k) || { item_code: r.item_code || "", description: r.item_name || "", unit: r.unit_code || "", boq_qty: 0, request_qty: 0, withdraw_qty: 0, project_count: 0 };
        e.boq_qty += num(r.qty);
        if (!e.unit && r.unit_code) e.unit = r.unit_code;
        map.set(k, e);
      }
    } catch (e) {
      console.error("getAllMaterials BOQ:", (e as Error).message);
    }

    // v2 requests (ຂໍເບີກ) across all projects — credited to the BOQ item.
    try {
      await ensureRequestSchema();
      const reqs = await query(`SELECT status, items FROM odg_request WHERE COALESCE(status,'') <> 'rejected'`);
      for (const r of reqs.rows as any[]) {
        const withdrawn = r.status === "withdrawn";
        for (const it of Array.isArray(r.items) ? r.items : []) {
          const e = map.get(keyOf(it.boq_item_code || it.item_code, it.description));
          if (!e) continue;
          if (withdrawn) e.withdraw_qty += num(it.qty);
          else e.request_qty += num(it.qty);
        }
      }
    } catch (e) {
      console.error("getAllMaterials requests:", (e as Error).message);
    }

    const data = Array.from(map.values()).map((e) => {
      const boqQty = num(e.boq_qty);
      const req = num(e.request_qty);
      const wd = num(e.withdraw_qty);
      return { ...e, boq_qty: boqQty, request_qty: req, withdraw_qty: wd, remaining: Math.max(boqQty - req - wd, 0) };
    });
    data.sort((a, b) => String(a.description).localeCompare(String(b.description)));
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
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
    const add = (code: any, desc: any, unit: any, qty: any, docNo?: any) => {
      const k = keyOf(code, desc);
      if (!k) return;
      const e = map.get(k) || { item_code: code || "", description: desc || "", unit: unit || "", boq_qty: 0, request_qty: 0, withdraw_qty: 0, boq_docs: new Set<string>() };
      e.boq_qty += num(qty);
      if (!e.unit && unit) e.unit = unit;
      if (!e.description && desc) e.description = desc;
      // Track which BOQ document(s) this item comes from.
      const dn = String(docNo || "").trim();
      if (dn) e.boq_docs.add(dn);
      map.set(k, e);
    };

    // ERP BOQs + requests/withdrawals
    try {
      const lb = await query(`SELECT doc_no FROM odg_projects_boq WHERE project_id::text = $1`, [String(projectId)]);
      const docNos = (lb.rows as any[]).map((r) => r.doc_no).filter(Boolean);
      if (docNos.length) {
        const ld = await query(
          `SELECT doc_no, item_code, item_name, unit_code, SUM(qty)::numeric AS qty
           FROM odg_projects_boq_detail WHERE doc_no = ANY($1::text[])
           GROUP BY doc_no, item_code, item_name, unit_code`,
          [docNos],
        );
        for (const r of ld.rows as any[]) add(r.item_code, r.item_name, r.unit_code, r.qty, r.doc_no);

        const rq = await query(
          `WITH requested AS (
             SELECT r.doc_no, d.item_code, SUM(d.qty)::numeric AS qty
             FROM odg_requests r
             JOIN odg_requests_detail d ON d.doc_no = r.doc_no
             WHERE r.doc_ref = ANY($1::text[])
             GROUP BY r.doc_no, d.item_code
           ),
           withdrawn AS (
             SELECT t.doc_ref AS request_no, d.item_code, SUM(d.qty)::numeric AS qty
             FROM ic_trans t
             JOIN ic_trans_detail d ON d.doc_no = t.doc_no
             WHERE t.doc_ref IN (SELECT doc_no FROM requested)
               AND t.doc_no <> t.doc_ref
               AND COALESCE(t.is_cancel, 0) = 0
             GROUP BY t.doc_ref, d.item_code
           )
           SELECT requested.item_code,
                  SUM(GREATEST(requested.qty - COALESCE(withdrawn.qty, 0), 0))::numeric AS req,
                  SUM(LEAST(requested.qty, COALESCE(withdrawn.qty, 0)))::numeric AS wd
           FROM requested
           LEFT JOIN withdrawn
             ON withdrawn.request_no = requested.doc_no
            AND withdrawn.item_code = requested.item_code
           GROUP BY requested.item_code`,
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
          // Substitutes (Option B): the line is issued as `item_code` (the real
          // product) but fulfils BOQ line `boq_item_code` — credit the drawdown
          // to the BOQ item so its remaining still closes out.
          const e = map.get(keyOf(it.boq_item_code || it.item_code, it.description));
          if (!e) continue;
          if (withdrawn) e.withdraw_qty += num(it.qty);
          else e.request_qty += num(it.qty);
          // Record substitutions: line issued as a different product than its BOQ item.
          const boqCode = String(it.boq_item_code || "").trim();
          const realCode = String(it.item_code || "").trim();
          if (boqCode && realCode && boqCode !== realCode) {
            if (!e.substitutes) e.substitutes = new Set<string>();
            e.substitutes.add(`${realCode}${String(it.description || it.item_name || "").trim()}`);
          }
        }
      }
    } catch (e) {
      // v2 request table not ready — totals still returned, but log it.
      console.error("getProjectMaterials: v2 request read failed:", e);
    }

    // Mobile app requests (odg_wo_material_request) — drawn down against BOQ too,
    // so "remaining" stays honest when a craftsman requests from the app.
    // pending/approved → request_qty; issued → withdraw_qty. The row's project_id
    // may be the canonical id OR the project's sml_code, so match both.
    try {
      let smlCode = "";
      try {
        const pr = await query(`SELECT sml_code FROM odg_projects WHERE id::text = $1 LIMIT 1`, [String(projectId)]);
        smlCode = String(pr.rows[0]?.sml_code || "");
      } catch {/* ignore */}
      const mreqs = await query(
        `SELECT status, items FROM odg_wo_material_request
           WHERE (project_id = $1 OR ($2 <> '' AND project_id = $2)) AND COALESCE(status,'') <> 'rejected'`,
        [String(projectId), smlCode],
      );
      for (const r of mreqs.rows as any[]) {
        const issued = r.status === "issued";
        for (const it of Array.isArray(r.items) ? r.items : []) {
          const e = map.get(keyOf(it.item_code, it.description || it.name));
          if (!e) continue;
          if (issued) e.withdraw_qty += num(it.qty);
          else e.request_qty += num(it.qty);
        }
      }
    } catch (e) {
      console.error("getProjectMaterials: mobile request read failed:", e);
    }

    const data = Array.from(map.values()).map((e) => {
      const boqQty = num(e.boq_qty);
      const pendingRequestQty = num(e.request_qty);
      const withdrawnQty = num(e.withdraw_qty);
      const availableQty = Math.max(boqQty - pendingRequestQty - withdrawnQty, 0);
      const boqDocs = e.boq_docs instanceof Set ? [...e.boq_docs] : Array.isArray(e.boq_docs) ? e.boq_docs : [];
      const SEP = String.fromCharCode(1);
      const substitutes = e.substitutes instanceof Set
        ? [...e.substitutes].map((s: string) => {
            const i = s.indexOf(SEP);
            return i >= 0 ? { code: s.slice(0, i), name: s.slice(i + 1) } : { code: s, name: "" };
          })
        : [];
      return {
        ...e,
        boq_qty: boqQty,
        request_qty: pendingRequestQty,
        pending_request_qty: pendingRequestQty,
        withdraw_qty: withdrawnQty,
        available_qty: availableQty,
        remaining: availableQty,
        boq_docs: boqDocs,
        substitutes,
      };
    });
    data.sort((a, b) => String(a.description).localeCompare(String(b.description)));
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
}
