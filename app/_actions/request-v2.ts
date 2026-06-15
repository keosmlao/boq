"use server";

import { query } from "@/_lib/db";
import { invalidate } from "@/_lib/cache";
import { ensureRequestSchema } from "@/_lib/schemas/request";
import { requirePermission } from "@/_lib/server-auth";
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
    return { success: true, data: rows };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Full request detail. For a legacy request (doc_no like REQ-...), also returns
 * the linked withdrawal slips from ic_trans/ic_trans_detail (doc_ref = doc_no).
 */
export async function getRequestDetail(id: string): Promise<{ success: true; data: any } | Fail> {
  try {
    await ensureRequestSchema();
    const sid = String(id);

    // v2 request (numeric id)
    if (/^\d+$/.test(sid)) {
      const r = await query(`SELECT * FROM odg_request WHERE id = $1 LIMIT 1`, [sid]);
      if (r.rows.length) {
        const x: any = r.rows[0];
        return {
          success: true,
          data: {
            ...x,
            items: Array.isArray(x.items) ? x.items : [],
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
        items: (det.rows as any[]).map((x) => ({ item_code: x.item_code, description: x.item_name, unit: x.unit_code, qty: x.qty })),
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
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const reqNo = body.request_no || `RQ-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const r = await query(
      `INSERT INTO odg_request (request_no, project_id, project_name, status, items, notes, requester)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [reqNo, String(body.project_id), body.project_name || null, body.status || "requested", JSON.stringify(items), body.notes || null, body.requester || null],
    );
    invalidate("req:");
    return { success: true, data: r.rows[0] };
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
    const r = await query(`UPDATE odg_request SET status = $2, updated_at = now() WHERE id = $1 RETURNING id`, [id, status]);
    if (!r.rows.length) return fail("Request not found");
    invalidate("req:");
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
      const r = await query(`DELETE FROM odg_request WHERE id = $1 RETURNING id`, [id]);
      if (r.rows.length) {
        invalidate("req:");
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

    if (isV2Id(id)) {
      const r = await query(
        `UPDATE odg_request SET items = $2, notes = $3, updated_at = now() WHERE id = $1 RETURNING id`,
        [id, JSON.stringify(items), body.notes ?? null],
      );
      if (r.rows.length) {
        invalidate("req:");
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
