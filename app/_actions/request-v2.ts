"use server";

import { query, withTransaction } from "@/_lib/db";
import { logActivity } from "./chatter";
import { invalidate } from "@/_lib/cache";
import { ensureRequestSchema } from "@/_lib/schemas/request";
import { requirePermission } from "@/_lib/server-auth";
import { getProjectMaterials } from "@/_actions/boq-v2";
import { setMaterialRequestStatusAs } from "@/_lib/workorder-core";
import {
  getRequests as getLegacyRequests,
  deleteRequest as deleteLegacyRequest,
  updateRequest as updateLegacyRequest,
} from "@/_actions/requests";

type Fail = { success: false; message: string };
function fail(message: string): Fail {
  return { success: false, message };
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const isV2Id = (id: unknown) => /^\d+$/.test(String(id));

/** The only statuses a request may hold (odg_request.status is an unconstrained TEXT column). */
const REQUEST_STATUSES = new Set(["requested", "withdrawn", "rejected"]);

// Material request (ໃບຂໍເບີກ) — ERP/SML convention, matching the legacy flow so
// SML picks up v2 requests in ic_trans alongside the old ones.
const IC_TRANS_REQUEST_TYPE = 3;
const IC_TRANS_REQUEST_FLAG = 122;

/** Resolve the ERP customer code (sml_code) for a project — used as ic_trans.cust_code. */
async function projectCustCode(projectId: string): Promise<string> {
  try {
    const r = await query(`SELECT sml_code FROM odg_projects WHERE id::text = $1 LIMIT 1`, [String(projectId)]);
    return String(r.rows[0]?.sml_code || "");
  } catch {
    return "";
  }
}

/** Remove a request's mirror document from SML (ic_trans + ic_trans_detail). */
async function removeSmlMirror(client: any, docNo: string) {
  await client.query(`DELETE FROM ic_trans_detail WHERE doc_no = $1 AND trans_type = $2 AND trans_flag = $3`, [docNo, IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG]);
  await client.query(`DELETE FROM ic_trans WHERE doc_no = $1 AND trans_type = $2 AND trans_flag = $3`, [docNo, IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG]);
}

/**
 * Mirror a v2 request into SML (ic_trans + ic_trans_detail) so the warehouse
 * sees it. Substitutes are issued as the real product (item_code), with the
 * original BOQ item noted in the line remark.
 */
async function mirrorRequestToSml(client: any, opts: {
  docNo: string;
  docDate: string;
  custCode: string;
  creator?: string | null;
  remark?: string | null;
  items: any[];
}) {
  const first = opts.items[0] || {};
  const whFrom = String(first.wh_code || "");
  const locFrom = String(first.shelf_code || "");
  await removeSmlMirror(client, opts.docNo);
  await client.query(
    `INSERT INTO ic_trans (
      trans_type, trans_flag, doc_date, doc_no, doc_ref,
      cust_code, wh_from, location_from,
      creator_code, user_request, remark, doc_success
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,0)`,
    [IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG, opts.docDate, opts.docNo, "", opts.custCode || "", whFrom, locFrom, opts.creator || "", opts.remark || ""],
  );
  let line = 0;
  for (const it of opts.items) {
    if (!(num(it.qty) > 0)) continue;
    line++;
    const lineRemark = isSubstituteLine(it) ? `ປ່ຽນຈາກ ${it.boq_item_name || it.boq_item_code}` : (it.remark || "");
    await client.query(
      `INSERT INTO ic_trans_detail (
        trans_type, trans_flag, doc_date, doc_no, doc_ref, cust_code,
        item_code, item_name, unit_code, qty,
        wh_code, shelf_code, line_number, remark
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG, opts.docDate, opts.docNo, "", opts.custCode || "",
        String(it.item_code || ""), String(it.description || it.item_name || ""), String(it.unit || it.unit_code || ""), num(it.qty),
        String(it.wh_code || whFrom), String(it.shelf_code || locFrom), line, lineRemark,
      ],
    );
  }
}

async function validateLocationStock(items: any[]): Promise<string | null> {
  const first = items[0];
  const warehouse = String(first?.wh_code || "").trim();
  const location = String(first?.shelf_code || "").trim();
  if (!warehouse || !location) return "ກະລຸນາເລືອກສາງ ແລະ ທີ່ຈັດເກັບ";

  const requested = new Map<string, number>();
  for (const item of items) {
    const code = String(item?.item_code || "").trim();
    if (!code) return "ບໍ່ສາມາດກວດ stock ໄດ້: ລາຍການວັດສະດຸບໍ່ມີລະຫັດ";
    if (String(item?.wh_code || "").trim() !== warehouse || String(item?.shelf_code || "").trim() !== location) {
      return "ລາຍການທັງໝົດຕ້ອງໃຊ້ສາງ ແລະ ທີ່ຈັດເກັບດຽວກັນ";
    }
    requested.set(code, (requested.get(code) || 0) + num(item.qty));
  }

  const codes = [...requested.keys()];
  const stock = await query(
    `SELECT trim(s.ic_code) AS ic_code, coalesce(sum(s.balance_qty), 0)::numeric AS balance_qty
     FROM unnest($2::text[]) AS requested(ic_code)
     CROSS JOIN LATERAL public.sml_ic_function_stock_balance_warehouse_location(
       $1, requested.ic_code, $3, $4
     ) AS s
     WHERE trim(s.ic_code) = requested.ic_code
     GROUP BY trim(s.ic_code)`,
    ["2099-12-31", codes, warehouse, location],
  );
  const balances = new Map((stock.rows as any[]).map((row) => [String(row.ic_code).trim(), Math.max(num(row.balance_qty), 0)]));
  for (const [code, qty] of requested) {
    const balance = balances.get(code) || 0;
    if (qty > balance) return `ລາຍການ ${code} ຂໍເບີກ ${qty} ເກີນ stock ຄົງເຫຼືອ ${balance}`;
  }
  return null;
}

/** The BOQ line a request item draws down — the original code for substitutes. */
function boqCodeOf(item: any): string {
  return String(item?.boq_item_code || item?.item_code || "").trim();
}

/** A line is a substitute when it issues a different product than its BOQ line. */
function isSubstituteLine(item: any): boolean {
  const boq = String(item?.boq_item_code || "").trim();
  return !!boq && boq !== String(item?.item_code || "").trim();
}

async function validateBoqAvailability(projectId: string, items: any[], editingId?: string): Promise<string | null> {
  const currentQty = new Map<string, number>();
  if (editingId) {
    if (isV2Id(editingId)) {
      const existing = await query(`SELECT items FROM odg_request WHERE id = $1 LIMIT 1`, [editingId]);
      for (const item of Array.isArray(existing.rows[0]?.items) ? existing.rows[0].items : []) {
        const code = boqCodeOf(item);
        if (code) currentQty.set(code, (currentQty.get(code) || 0) + num(item.qty));
      }
    } else {
      const existing = await query(`SELECT item_code, qty FROM odg_requests_detail WHERE doc_no = $1`, [editingId]);
      for (const item of existing.rows as any[]) {
        const code = String(item?.item_code || "").trim();
        if (code) currentQty.set(code, (currentQty.get(code) || 0) + num(item.qty));
      }
    }
  }

  const materials = await getProjectMaterials(projectId);
  if (!materials.success) return (materials as { message?: string }).message || "ໂຫຼດວັດສະດຸບໍ່ສຳເລັດ";
  const available = new Map(
    materials.data.map((item: any) => [String(item.item_code || "").trim(), num(item.remaining)]),
  );
  // Aggregate the requested qty per BOQ line (substitutes count against their BOQ code).
  const requested = new Map<string, number>();
  for (const item of items) {
    const code = boqCodeOf(item);
    requested.set(code, (requested.get(code) || 0) + num(item.qty));
  }
  for (const [code, qty] of requested) {
    const canRequest = (available.get(code) || 0) + (currentQty.get(code) || 0);
    if (qty > canRequest) return `ລາຍການ ${code} ຂໍເບີກ ${qty} ເກີນ BOQ ຄົງເຫຼືອທີ່ເບີກເພີ່ມໄດ້ ${canRequest}`;
  }
  return null;
}

export async function getRequests(opts: { projectId?: string } = {}): Promise<{ success: true; data: any[] } | Fail> {
  try {
    await ensureRequestSchema();
    const r = opts.projectId
      ? await query(`SELECT * FROM odg_request WHERE project_id = $1 ORDER BY created_at DESC`, [String(opts.projectId)])
      : await query(`SELECT * FROM odg_request ORDER BY created_at DESC LIMIT 500`);
    const rows: any[] = r.rows.map((x: any) => ({ ...x, src: "v2" }));

    // Merge legacy requests (odg_requests). "ເບີກແລ້ວ" = there is an ic_trans
    // withdrawal document referencing the request doc_no (ic_trans.doc_ref).
    try {
      const legacy: any[] = (await getLegacyRequests({ projectId: opts.projectId })) as any[];
      const docNos = (legacy || []).map((r) => r.doc_no).filter(Boolean);
      let withdrawn = new Set<string>();
      if (docNos.length) {
        try {
          const wt = await query(
            `SELECT DISTINCT doc_ref FROM ic_trans WHERE doc_ref = ANY($1::text[]) AND COALESCE(is_cancel,0) = 0`,
            [docNos],
          );
          withdrawn = new Set((wt.rows as any[]).map((x) => String(x.doc_ref)));
        } catch {
          /* ic_trans not reachable — fall back to no-withdrawn */
        }
      }
      for (const lr of legacy || []) {
        rows.push({
          id: lr.doc_no,
          request_no: lr.doc_no,
          project_id: lr.project_id != null ? String(lr.project_id) : "",
          project_name: lr.project_name || null,
          status: withdrawn.has(String(lr.doc_no)) ? "withdrawn" : "requested",
          items: (Array.isArray(lr.list) ? lr.list : []).map((x: any) => ({
            item_code: x.item_code,
            description: x.item_name,
            unit: x.unit_code,
            qty: x.qty,
          })),
          created_at: lr.created_at || lr.doc_date,
          src: "erp",
        });
      }
    } catch {
      /* legacy requests table/cols differ — v2 still returned */
    }

    // Mobile app requests (odg_wo_material_request) — raised by craftsmen in the
    // app. Surface them in the same list so the back office sees them here too.
    // status: issued → withdrawn(ເບີກແລ້ວ), rejected → rejected, else requested.
    try {
      const app = opts.projectId
        ? await query(
            `SELECT m.*, (SELECT project_name FROM odg_projects p WHERE p.id::text = m.project_id OR p.sml_code = m.project_id LIMIT 1) AS project_name
               FROM odg_wo_material_request m
              WHERE m.project_id = $1 OR m.project_id = (SELECT sml_code FROM odg_projects WHERE id::text = $1 LIMIT 1)
              ORDER BY m.created_at DESC`,
            [String(opts.projectId)],
          )
        : await query(
            `SELECT m.*, (SELECT project_name FROM odg_projects p WHERE p.id::text = m.project_id OR p.sml_code = m.project_id LIMIT 1) AS project_name
               FROM odg_wo_material_request m ORDER BY m.created_at DESC LIMIT 500`,
          );
      for (const r of app.rows as any[]) {
        const st = String(r.status || "pending");
        rows.push({
          id: `app-${r.id}`,
          request_no: `APP-${r.id}`,
          project_id: r.project_id != null ? String(r.project_id) : "",
          project_name: r.project_name || null,
          status: st === "issued" || st === "converted" ? "withdrawn" : st === "rejected" ? "rejected" : "requested",
          app_status: st, // raw: pending (ລໍຫົວໜ້າຊ່າງ) / approved (ລໍດຶງ) / converted / rejected
          items: Array.isArray(r.items) ? r.items : [],
          requester: r.requested_by || null,
          used_by_name: r.used_by_name || null,
          created_at: r.created_at,
          src: "app",
        });
      }
    } catch {
      /* odg_wo_material_request unreachable — other sources still returned */
    }

    // App requests the head craftsman has APPROVED (awaiting pull) float to the
    // very top so admin sees what to issue; everything else by newest date.
    const awaitingPull = (r: any) => (r.src === "app" && r.app_status === "approved" ? 0 : 1);
    rows.sort((a, b) => {
      const ap = awaitingPull(a), bp = awaitingPull(b);
      if (ap !== bp) return ap - bp;
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
    return { success: true, data: rows };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Full request detail. For a legacy request (doc_no like REQ-...), also returns
 * the linked withdrawal slips from ic_trans/ic_trans_detail (doc_ref = doc_no).
 */
/** Web: advance an app material request (id like "app-123") — approved/issued/rejected. */
export async function setAppRequestStatus(appId: string, status: string, note?: string): Promise<{ success: true; data: any } | Fail> {
  try {
    const user = await requirePermission("requests", "approve");
    const realId = String(appId).startsWith("app-") ? String(appId).slice(4) : String(appId);
    const res = await setMaterialRequestStatusAs(
      { username: user?.username || "", name: user?.name, role: user?.role, permissions: user?.permissions as any },
      realId,
      status,
      note,
    );
    if (res.success) {
      invalidate("req:");
      await logActivity("request", appId, "ປ່ຽນສະຖານະໃບຂໍເບີກ", status);
    }
    return res as { success: true; data: any } | Fail;
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getRequestDetail(id: string): Promise<{ success: true; data: any } | Fail> {
  try {
    await ensureRequestSchema();
    const sid = String(id);

    // Mobile app request (odg_wo_material_request) — read-only view on web.
    if (sid.startsWith("app-")) {
      const realId = sid.slice(4);
      const r = await query(`SELECT * FROM odg_wo_material_request WHERE id = $1 LIMIT 1`, [realId]);
      if (!r.rows.length) return fail("Request not found");
      const x: any = r.rows[0];
      const issued = String(x.status) === "issued";
      let projectName = "";
      try {
        const p = await query(`SELECT project_name FROM odg_projects WHERE id::text = $1 OR sml_code = $1 LIMIT 1`, [String(x.project_id || "")]);
        projectName = p.rows[0]?.project_name || "";
      } catch {/* ignore */}
      // ຜູ້ໃຊ້ວັດສະດຸ defaults to the job's team/craftsman (the WO technician), so a
      // pulled requisition is locked to who actually requested it.
      let usedByCode = String(x.used_by_code || "");
      let usedByName = String(x.used_by_name || "");
      try {
        const wid = String(x.work_order_id || "");
        if (!usedByCode && wid) {
          if (wid.startsWith("erp-") && /^\d+$/.test(wid.slice(4))) {
            const w = await query(`SELECT technician_id FROM odg_work_orders WHERE id = $1 LIMIT 1`, [wid.slice(4)]);
            usedByCode = String(w.rows[0]?.technician_id || "");
          } else if (/^\d+$/.test(wid)) {
            const w = await query(`SELECT technician_code, technician_name FROM odg_work_order WHERE id = $1 LIMIT 1`, [wid]);
            usedByCode = String(w.rows[0]?.technician_code || "");
            usedByName = usedByName || String(w.rows[0]?.technician_name || "");
          }
        }
        if (usedByCode && !usedByName) {
          const tn = await query(`SELECT name_1 FROM odg_technicians WHERE code = $1 LIMIT 1`, [usedByCode]);
          usedByName = String(tn.rows[0]?.name_1 || usedByCode);
        }
      } catch {/* ignore */}
      return {
        success: true,
        data: {
          id: sid,
          request_no: `APP-${x.id}`,
          project_id: x.project_id != null ? String(x.project_id) : "",
          project_name: projectName,
          status: issued || String(x.status) === "converted" ? "withdrawn" : String(x.status) === "rejected" ? "rejected" : "requested",
          app_status: String(x.status || "pending"),
          notes: x.note || null,
          requester: x.requested_by || null,
          used_by_code: usedByCode || null,
          used_by_name: usedByName || null,
          created_at: x.created_at,
          items: (Array.isArray(x.items) ? x.items : []).map((it: any) => ({
            item_code: it.item_code || "",
            description: it.name || it.description || "",
            unit: it.unit || "",
            qty: num(it.qty),
            withdrawn_qty: issued ? num(it.qty) : 0,
            item_status: issued ? "withdrawn" : "requested",
          })),
          withdrawals: [],
          src: "app",
        },
      };
    }

    // v2 request (numeric id)
    if (/^\d+$/.test(sid)) {
      const r = await query(`SELECT * FROM odg_request WHERE id = $1 LIMIT 1`, [sid]);
      if (r.rows.length) {
        const x: any = r.rows[0];
        const isWithdrawn = String(x.status) === "withdrawn";
        return {
          success: true,
          data: {
            ...x,
            items: (Array.isArray(x.items) ? x.items : []).map((item: any) => ({
              ...item,
              withdrawn_qty: isWithdrawn ? num(item.qty) : 0,
              item_status: isWithdrawn ? "withdrawn" : "requested",
              substituted: isSubstituteLine(item),
            })),
            withdrawals: [],
            src: "v2",
          },
        };
      }
    }

    // legacy request (odg_requests) by doc_no
    const h = await query(`SELECT * FROM odg_requests WHERE doc_no = $1 LIMIT 1`, [sid]);
    if (!h.rows.length) return fail("Request not found");
    const head: any = h.rows[0];

    let projectName: string | null = null;
    try {
      projectName = (await query(`SELECT project_name FROM odg_projects WHERE id::text = $1`, [String(head.project_id)])).rows[0]?.project_name || null;
    } catch {
      /* ignore */
    }

    const det = await query(
      `SELECT item_code, item_name, unit_code, qty, remark FROM odg_requests_detail WHERE doc_no = $1 ORDER BY line_no NULLS LAST, id`,
      [sid],
    );

    const withdrawals: any[] = [];
    try {
      const wt = await query(
        `SELECT doc_no, doc_date, doc_time, remark FROM ic_trans WHERE doc_ref = $1 AND COALESCE(is_cancel,0) = 0 ORDER BY doc_date, doc_time`,
        [sid],
      );
      for (const w of wt.rows as any[]) {
        // Resolved names (warehouse, shelf, withdrawer) from odg_withdraw_info.
        let info: any[] = [];
        try {
          info = (
            await query(
              `SELECT item_code, item_name, unit_code, qty, wh_name, shelf_name, createuser FROM odg_withdraw_info WHERE doc_no = $1`,
              [w.doc_no],
            )
          ).rows as any[];
        } catch {
          /* ignore */
        }
        if (!info.length) {
          try {
            info = (
              await query(
                `SELECT item_code, item_name, unit_code, qty, wh_code AS wh_name, shelf_code AS shelf_name, NULL AS createuser FROM ic_trans_detail WHERE doc_no = $1 ORDER BY line_number NULLS LAST, roworder`,
                [w.doc_no],
              )
            ).rows as any[];
          } catch {
            /* ignore */
          }
        }
        const uniq = (k: string) => [...new Set(info.map((x) => x[k]).filter(Boolean))];
        withdrawals.push({
          doc_no: w.doc_no,
          doc_date: w.doc_date,
          doc_time: w.doc_time,
          remark: w.remark,
          withdrawerCodes: uniq("createuser"),
          wh_name: uniq("wh_name").join(", "),
          shelf_name: uniq("shelf_name").join(", "),
          items: info,
        });
      }
    } catch {
      /* ic_trans not reachable */
    }

    // Resolve employee codes -> names (odg_employee.employee_code -> fullname_lo).
    const empMap: Record<string, string> = {};
    try {
      const codes = [
        ...new Set([...withdrawals.flatMap((w) => w.withdrawerCodes || []), head.creator_code].filter(Boolean).map(String)),
      ];
      if (codes.length) {
        const e = await query(`SELECT employee_code, fullname_lo FROM odg_employee WHERE employee_code = ANY($1::text[])`, [codes]);
        for (const row of e.rows as any[]) empMap[String(row.employee_code)] = row.fullname_lo;
      }
    } catch {
      /* odg_employee not reachable */
    }
    for (const w of withdrawals) {
      w.withdrawer = (w.withdrawerCodes || []).map((c: string) => empMap[String(c)] || c).join(", ");
    }
    const requesterName = empMap[String(head.creator_code)] || head.requester_name || head.creator_code || null;
    const withdrawnByItem = new Map<string, number>();
    for (const withdrawal of withdrawals) {
      for (const item of Array.isArray(withdrawal.items) ? withdrawal.items : []) {
        const code = String(item.item_code || "").trim();
        if (code) withdrawnByItem.set(code, (withdrawnByItem.get(code) || 0) + num(item.qty));
      }
    }
    const remainingWithdrawnByItem = new Map(withdrawnByItem);
    const requestItems = (det.rows as any[]).map((x) => {
      const requestedQty = num(x.qty);
      const code = String(x.item_code || "").trim();
      const withdrawnQty = Math.min(requestedQty, remainingWithdrawnByItem.get(code) || 0);
      remainingWithdrawnByItem.set(code, Math.max((remainingWithdrawnByItem.get(code) || 0) - withdrawnQty, 0));
      return {
        item_code: x.item_code,
        description: x.item_name,
        unit: x.unit_code,
        qty: x.qty,
        withdrawn_qty: withdrawnQty,
        item_status: withdrawnQty >= requestedQty ? "withdrawn" : withdrawnQty > 0 ? "partial" : "requested",
      };
    });

    return {
      success: true,
      data: {
        request_no: head.doc_no,
        doc_no: head.doc_no,
        project_id: head.project_id != null ? String(head.project_id) : "",
        project_name: projectName,
        created_at: head.created_at || head.doc_date,
        requester: requesterName,
        notes: head.remark || null,
        status: withdrawals.length ? "withdrawn" : "requested",
        items: requestItems,
        withdrawals,
        src: "erp",
      },
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getRequestById(id: string): Promise<{ success: true; data: any } | Fail> {
  try {
    await ensureRequestSchema();
    const r = await query(`SELECT * FROM odg_request WHERE id = $1 LIMIT 1`, [id]);
    if (!r.rows.length) return fail("Request not found");
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createRequest(body: any): Promise<{ success: true; data: any } | Fail> {
  try {
    await requirePermission("requests", "create");
    await ensureRequestSchema();
    if (!body?.project_id) return fail("project_id is required");
    const items = (Array.isArray(body.items) ? body.items : []).filter((it: any) => num(it.qty) > 0);
    if (!items.length) return fail("ກະລຸນາໃສ່ລາຍການທີ່ຕ້ອງເບີກ");
    const boqError = await validateBoqAvailability(String(body.project_id), items);
    if (boqError) return fail(boqError);
    const stockError = await validateLocationStock(items);
    if (stockError) return fail(stockError);
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const reqNo = body.request_no || `RQ-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const hasSub = items.some(isSubstituteLine);
    const custCode = await projectCustCode(String(body.project_id));
    const docDate = d.toISOString().slice(0, 10);
    let created: any = null;
    await withTransaction(async (client: any) => {
      const r = await client.query(
        `INSERT INTO odg_request (request_no, project_id, project_name, status, items, notes, requester, used_by_code, used_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [reqNo, String(body.project_id), body.project_name || null, body.status || "requested", JSON.stringify(items), body.notes || null, body.requester || null, body.used_by_code || null, body.used_by_name || null],
      );
      created = r.rows[0];
      // Push to SML now unless it needs substitution approval first.
      if (!hasSub) {
        await mirrorRequestToSml(client, { docNo: reqNo, docDate, custCode, creator: body.requester || null, remark: body.notes || null, items });
      }
      // Pulled from an app request → mark it converted so it leaves the pending
      // queue and stops drawing down BOQ (this new RQ now counts instead).
      if (body.from_app_id) {
        const realAppId = String(body.from_app_id).startsWith("app-") ? String(body.from_app_id).slice(4) : String(body.from_app_id);
        try {
          await client.query(
            `UPDATE odg_wo_material_request SET status = 'converted', approver = $2, status_at = now(), status_note = $3 WHERE id = $1`,
            [realAppId, body.requester || null, `ດຶງເປັນ ${reqNo}`],
          );
        } catch {/* app request table/row issue — RQ still created */}
      }
    });
    invalidate("req:");
    invalidate("ic:");
    await logActivity("request", String(created?.id ?? ""), "ສ້າງໃບຂໍເບີກ", created?.request_no ?? undefined);
    return { success: true, data: created };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** status: requested | withdrawn | rejected */
export async function setRequestStatus(id: string, status: string): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("requests", "approve");
    if (!REQUEST_STATUSES.has(status)) return fail("ສະຖານະບໍ່ຖືກຕ້ອງ");
    await ensureRequestSchema();
    // A request with substitute lines may not be withdrawn until the
    // substitution is approved (requests.approve_substitute).
    if (status === "withdrawn" && isV2Id(id)) {
      const cur = await query(`SELECT items, substitute_approved FROM odg_request WHERE id = $1 LIMIT 1`, [id]);
      const row: any = cur.rows[0];
      const items = Array.isArray(row?.items) ? row.items : [];
      if (items.some(isSubstituteLine) && !row?.substitute_approved) {
        return fail("ໃບເບີກນີ້ມີການປ່ຽນສິນຄ້າ — ຕ້ອງໃຫ້ຜູ້ມີສິດອະນຸມັດການປ່ຽນແທນກ່ອນຈຶ່ງເບີກໄດ້");
      }
    }
    const r = await query(`UPDATE odg_request SET status = $2, updated_at = now() WHERE id = $1 RETURNING id`, [id, status]);
    if (!r.rows.length) return fail("Request not found");
    invalidate("req:");
    await logActivity("request", id, "ປ່ຽນສະຖານະ", status);
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Approve the item substitutions on a request (requests.approve_substitute). */
export async function approveSubstitute(id: string): Promise<{ success: true } | Fail> {
  try {
    const user = await requirePermission("requests", "approve_substitute");
    await ensureRequestSchema();
    if (!isV2Id(id)) return fail("ໃບເບີກນີ້ບໍ່ຮອງຮັບການປ່ຽນແທນ");
    const approver = (user?.name || user?.username || "").toString() || null;
    let custCode = "";
    let mirrored: any = null;
    await withTransaction(async (client: any) => {
      const r = await client.query(
        `UPDATE odg_request SET substitute_approved = true, substitute_approver = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [id, approver],
      );
      mirrored = r.rows[0];
      if (!mirrored) return;
      // Now that the substitution is approved, push it to SML.
      custCode = await projectCustCode(String(mirrored.project_id));
      const docDate = new Date(mirrored.created_at || Date.now()).toISOString().slice(0, 10);
      await mirrorRequestToSml(client, {
        docNo: mirrored.request_no,
        docDate,
        custCode,
        creator: mirrored.requester || null,
        remark: mirrored.notes || null,
        items: Array.isArray(mirrored.items) ? mirrored.items : [],
      });
    });
    if (!mirrored) return fail("Request not found");
    invalidate("req:");
    invalidate("ic:");
    await logActivity("request", id, "ອະນຸມັດການປ່ຽນສິນຄ້າ", approver ?? undefined);
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteRequest(id: string): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("requests", "delete");
    await ensureRequestSchema();
    if (isV2Id(id)) {
      let deleted = false;
      await withTransaction(async (client: any) => {
        const r = await client.query(`DELETE FROM odg_request WHERE id = $1 RETURNING request_no`, [id]);
        if (r.rows.length) {
          deleted = true;
          // Pull its mirror document out of SML too.
          if (r.rows[0].request_no) await removeSmlMirror(client, String(r.rows[0].request_no));
        }
      });
      if (deleted) {
        await logActivity("request", id, "ລຶບໃບຂໍເບີກ");
        invalidate("req:");
        invalidate("ic:");
        return { success: true };
      }
    }
    // legacy odg_requests (by doc_no) — also clears its ic_trans request lines.
    const res: any = await deleteLegacyRequest(String(id));
    if (res?.success) {
      invalidate("req:");
      return { success: true };
    }
    return fail(res?.message === "ALREADY_WITHDRAWN" ? "ເບີກແລ້ວ — ລົບບໍ່ໄດ້" : res?.message || "ລົບບໍ່ສຳເລັດ");
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Edit a request (v2 or legacy). items: [{item_code, description, unit, qty}]. */
export async function updateRequest(id: string, body: any): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("requests", "edit");
    await ensureRequestSchema();
    const items = (Array.isArray(body?.items) ? body.items : []).filter((it: any) => num(it.qty) > 0);
    if (!items.length) return fail("ກະລຸນາໃສ່ລາຍການທີ່ຕ້ອງເບີກ");
    const projectResult = isV2Id(id)
      ? await query(`SELECT project_id FROM odg_request WHERE id = $1 LIMIT 1`, [id])
      : await query(`SELECT project_id::text AS project_id FROM odg_requests WHERE doc_no = $1 LIMIT 1`, [id]);
    const projectId = String(projectResult.rows[0]?.project_id || "");
    if (!projectId) return fail("ບໍ່ພົບໂຄງການຂອງໃບຂໍເບີກ");
    const boqError = await validateBoqAvailability(projectId, items, id);
    if (boqError) return fail(boqError);
    const stockError = await validateLocationStock(items);
    if (stockError) return fail(stockError);

    if (isV2Id(id)) {
      const hasSub = items.some(isSubstituteLine);
      const custCode = await projectCustCode(projectId);
      let ok = false;
      await withTransaction(async (client: any) => {
        // Editing the lines invalidates any prior substitution approval.
        const r = await client.query(
          `UPDATE odg_request SET items = $2, notes = $3, used_by_code = $4, used_by_name = $5, substitute_approved = false, substitute_approver = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
          [id, JSON.stringify(items), body.notes ?? null, body.used_by_code ?? null, body.used_by_name ?? null],
        );
        const row = r.rows[0];
        if (!row) return;
        ok = true;
        await logActivity("request", id, "ແກ້ໄຂໃບຂໍເບີກ");
        // Re-sync SML: a substituted (now-unapproved) request is pulled until
        // re-approved; otherwise the mirror is refreshed with the new lines.
        if (hasSub) {
          await removeSmlMirror(client, String(row.request_no));
        } else {
          const docDate = new Date(row.created_at || Date.now()).toISOString().slice(0, 10);
          await mirrorRequestToSml(client, { docNo: row.request_no, docDate, custCode, creator: row.requester || null, remark: row.notes || null, items });
        }
      });
      if (ok) {
        invalidate("req:");
        invalidate("ic:");
        return { success: true };
      }
    }
    // legacy
    const res: any = await updateLegacyRequest(String(id), { items, notes: body.notes ?? null });
    if (res?.success) {
      invalidate("req:");
      return { success: true };
    }
    return fail(res?.message === "ALREADY_WITHDRAWN" ? "ເບີກແລ້ວ — ແກ້ໄຂບໍ່ໄດ້" : res?.message || "ບັນທຶກບໍ່ສຳເລັດ");
  } catch (e) {
    return fail((e as Error).message);
  }
}
