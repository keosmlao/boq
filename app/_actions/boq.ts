"use server";

import { query, withTransaction } from "@/_lib/db";
import { invalidate } from "@/_lib/cache";
import { logActivity } from "./chatter";
import { cleanText, toNumber } from "@/_lib/http";
import { approveAccounting } from "@/_lib/projects";
import { getSessionUser, requirePermission } from "@/_lib/server-auth";
import { isAdmin, can } from "@/_lib/permissions";
import { seedStandardInstallTasks } from "@/_lib/standard-tasks";

type Ok<T = unknown> = { success: true } & T;
type Fail = { success: false; message: string; [extra: string]: unknown };

function fail(message: string, extra: Record<string, unknown> = {}): Fail {
  return { success: false, message, ...extra };
}

/**
 * Is this the first BOQ of its contract? The first BOQ of a contract may be
 * approved by a manager (boq.approve); every subsequent (2nd+) BOQ of the SAME
 * contract may only be approved by an admin (ຜູ້ດູແລລະບົບ). BOQs with no
 * contract fall back to per-project ordering.
 */
async function isFirstBoqForContract(decodedDocNo: string): Promise<boolean> {
  const r = await query(
    `SELECT COUNT(*)::int AS earlier
       FROM odg_projects_boq b2
       JOIN odg_projects_boq b ON b.doc_no = $1
      WHERE ((b.contract_id IS NOT NULL AND b2.contract_id = b.contract_id)
             OR (b.contract_id IS NULL AND b2.project_id = b.project_id))
        AND b2.doc_no <> b.doc_no
        AND (b2.doc_date < b.doc_date
             OR (b2.doc_date = b.doc_date AND b2.roworder < b.roworder)
             OR (b2.doc_date IS NULL AND b2.roworder < b.roworder))`,
    [decodedDocNo],
  );
  return Number(r.rows[0]?.earlier ?? 0) === 0;
}

export async function getListBoq(opts: { includeItems?: boolean; itemSearch?: string } = {}): Promise<unknown[]> {
  const includeItems = !!opts.includeItems;
  const itemSearch = cleanText(opts.itemSearch);

  const values: unknown[] = [];
  let itemFilter = "";
  if (itemSearch) {
    values.push(`%${itemSearch}%`);
    itemFilter = `
      AND EXISTS (
        SELECT 1
        FROM odg_projects_boq_detail fd
        WHERE fd.doc_no = b.doc_no
          AND (fd.item_code ILIKE $${values.length} OR fd.item_name ILIKE $${values.length})
      )
    `;
  }

  const result = await query(
    `
      WITH requested_per_item AS (
        SELECT
          r.doc_ref AS boq_doc_no,
          d.item_code,
          SUM(CASE WHEN COALESCE(r.doc_success, 0) = 0 THEN d.qty ELSE 0 END)::numeric AS request_qty,
          SUM(CASE WHEN COALESCE(r.doc_success, 0) = 1 THEN d.qty ELSE 0 END)::numeric AS withdraw_qty
        FROM odg_requests r
        INNER JOIN odg_requests_detail d ON d.doc_no = r.doc_no
        WHERE r.doc_ref IS NOT NULL AND r.doc_ref <> ''
        GROUP BY r.doc_ref, d.item_code
      ),
      requested_per_boq AS (
        SELECT
          boq_doc_no,
          SUM(request_qty)::numeric  AS total_request,
          SUM(withdraw_qty)::numeric AS total_withdraw
        FROM requested_per_item
        GROUP BY boq_doc_no
      ),
      boq_totals AS (
        SELECT
          bd.doc_no,
          COUNT(*)::int AS total_items,
          COALESCE(SUM(bd.qty), 0)::numeric AS boq_total_qty,
          json_agg(
            json_build_object(
              'item_code',   bd.item_code,
              'item_name',   bd.item_name,
              'qty',         bd.qty,
              'boq_qty',     bd.qty,
              'unit_code',   bd.unit_code,
              'contract_id', bd.contract_id,
              'project_id',  bd.project_id,
              'request_qty', COALESCE(rpi.request_qty, 0),
              'withdraw',    COALESCE(rpi.withdraw_qty, 0),
              'withdraw_qty',COALESCE(rpi.withdraw_qty, 0),
              'balance',     GREATEST(bd.qty - COALESCE(rpi.request_qty, 0) - COALESCE(rpi.withdraw_qty, 0), 0)
            )
            ORDER BY bd.roworder ASC
          ) AS boq_list
        FROM odg_projects_boq_detail bd
        LEFT JOIN requested_per_item rpi
          ON rpi.boq_doc_no = bd.doc_no AND rpi.item_code = bd.item_code
        GROUP BY bd.doc_no
      )
      SELECT
        b.roworder AS id,
        b.doc_no,
        b.doc_date,
        b.cust_code,
        b.project_id,
        COALESCE(euc.fullname_lo, b.user_created) AS user_created,
        COALESCE(b.approve_status, 0)::int AS approve_status,
        COALESCE(eap.fullname_lo, b.approver) AS approver,
        b.contract_id,
        p.project_name,
        p.coordinator,
        p.phone,
        p.image_url,
        c.contract_no,
        c.contract_name,
        COALESCE(t.total_items, 0)::int                 AS total_items,
        COALESCE(t.boq_total_qty, 0)::numeric           AS boq_total_qty,
        COALESCE(rpb.total_request, 0)::numeric         AS request_total_qty,
        COALESCE(rpb.total_withdraw, 0)::numeric        AS withdraw_total_qty
        ${includeItems ? ", COALESCE(t.boq_list, '[]'::json) AS boq_list" : ""}
      FROM odg_projects_boq b
      LEFT JOIN odg_projects p
        ON p.id::text = b.project_id::text
      LEFT JOIN odg_projects_contract c
        ON c.roworder = b.contract_id
      LEFT JOIN boq_totals t
        ON t.doc_no = b.doc_no
      LEFT JOIN requested_per_boq rpb
        ON rpb.boq_doc_no = b.doc_no
      LEFT JOIN odg_employee euc
        ON euc.employee_code = b.user_created
      LEFT JOIN odg_employee eap
        ON eap.employee_code = b.approver
      WHERE 1=1
      ${itemFilter}
      ORDER BY b.doc_date DESC NULLS LAST, b.roworder DESC
    `,
    values,
  );

  return result.rows;
}

export async function getBoq(docNo: string): Promise<Record<string, unknown> | { success: false; message: string }> {
  try {
    const decodedDocNo = decodeURIComponent(docNo);
    const header = await query(
      `
        SELECT b.*, p.project_name, p.coordinator, p.phone, p.image_url,
               c.contract_no, c.contract_name,
               COALESCE(euc.fullname_lo, b.user_created) AS creator_name,
               COALESCE(eap.fullname_lo, b.approver)     AS approver_name
        FROM odg_projects_boq b
        LEFT JOIN odg_projects p ON p.id::text = b.project_id::text
        LEFT JOIN odg_projects_contract c ON c.roworder = b.contract_id
        LEFT JOIN odg_employee euc ON euc.employee_code = b.user_created
        LEFT JOIN odg_employee eap ON eap.employee_code = b.approver
        WHERE b.doc_no = $1
        LIMIT 1
      `,
      [decodedDocNo],
    );

    if (!header.rows[0]) return { success: false, message: "BOQ not found" };

    const details = await query(
      `
        WITH requested_per_item AS (
          SELECT d.item_code,
            SUM(CASE WHEN COALESCE(r.doc_success, 0) = 0 THEN d.qty ELSE 0 END)::numeric AS request_qty,
            SUM(CASE WHEN COALESCE(r.doc_success, 0) = 1 THEN d.qty ELSE 0 END)::numeric AS withdraw_qty
          FROM odg_requests r
          INNER JOIN odg_requests_detail d ON d.doc_no = r.doc_no
          WHERE r.doc_ref = $1
          GROUP BY d.item_code
        )
        SELECT
          bd.roworder, bd.doc_no, bd.doc_date, bd.cust_code,
          bd.item_code, bd.item_name, bd.qty, bd.qty AS boq_qty,
          bd.unit_code, bd.contract_id, bd.project_id,
          COALESCE(rpi.request_qty, 0)::numeric  AS request_qty,
          COALESCE(rpi.withdraw_qty, 0)::numeric AS withdraw,
          COALESCE(rpi.withdraw_qty, 0)::numeric AS withdraw_qty,
          GREATEST(bd.qty - COALESCE(rpi.request_qty, 0) - COALESCE(rpi.withdraw_qty, 0), 0)::numeric AS balance
        FROM odg_projects_boq_detail bd
        LEFT JOIN requested_per_item rpi ON rpi.item_code = bd.item_code
        WHERE bd.doc_no = $1
        ORDER BY bd.roworder ASC
      `,
      [decodedDocNo],
    );

    const boqTotal = details.rows.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const requestTotal = details.rows.reduce((sum, item) => sum + Number(item.request_qty || 0), 0);
    const withdrawTotal = details.rows.reduce((sum, item) => sum + Number(item.withdraw || 0), 0);

    const isFirst = await isFirstBoqForContract(decodedDocNo);

    return {
      ...header.rows[0],
      is_first: isFirst,
      boq_list: details.rows,
      total_items: details.rows.length,
      boq_total_qty: boqTotal,
      request_total_qty: requestTotal,
      withdraw_total_qty: withdrawTotal,
      remaining_total_qty: Math.max(boqTotal - requestTotal - withdrawTotal, 0),
    };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

export async function deleteBoq(docNo: string): Promise<Ok | Fail> {
  try {
    await requirePermission("boq", "delete");
    const decodedDocNo = decodeURIComponent(docNo);
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM odg_projects_boq_detail WHERE doc_no = $1`, [decodedDocNo]);
      await client.query(`DELETE FROM odg_projects_boq WHERE doc_no = $1`, [decodedDocNo]);
    });
    await logActivity("boq", decodedDocNo, "ລຶບ BOQ");
    invalidate("projects:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getBoqContractItems(opts: { custCode?: string; contractId?: number | string; contractNo?: string }): Promise<unknown[]> {
  const custCode = cleanText(opts.custCode);
  const contractId = toNumber(opts.contractId, 0);
  const contractNo = cleanText(opts.contractNo);

  const values: unknown[] = [];
  const where: string[] = [];

  if (custCode) {
    values.push(custCode);
    where.push(`d.cust_code = $${values.length}`);
  }
  if (contractId) {
    values.push(contractId);
    where.push(`d.contract_id = $${values.length}`);
  } else if (contractNo) {
    values.push(contractNo);
    where.push(`c.contract_no = $${values.length}`);
  }

  const result = await query(
    `
      SELECT
        d.item_code, d.item_name, d.unit_code,
        SUM(d.qty)::numeric AS boq_qty,
        0::numeric AS withdraw_qty,
        SUM(d.qty)::numeric AS remaining_qty,
        d.contract_id
      FROM odg_projects_boq_detail d
      LEFT JOIN odg_projects_contract c ON c.roworder = d.contract_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY d.item_code, d.item_name, d.unit_code, d.contract_id
      ORDER BY d.item_code ASC
    `,
    values,
  );

  return result.rows;
}

function parseDocDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return new Date().toISOString().slice(0, 10);
  const dmy = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function docMonthKey(docDate: string) {
  return docDate.slice(0, 7).replace("-", "");
}

async function nextBoqDocNo(client: any, monthKey: string) {
  const result = await client.query(
    `SELECT doc_no FROM odg_projects_boq WHERE doc_no LIKE $1 ORDER BY doc_no DESC LIMIT 1`,
    [`BOQ-${monthKey}-%`],
  );
  const lastDocNo = cleanText(result.rows[0]?.doc_no);
  const lastSeq = toNumber(lastDocNo.split("-").at(-1), 0);
  return `BOQ-${monthKey}-${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function saveBoq(payload: Record<string, unknown>): Promise<{ success: true; message: string; doc_no: string; total_items: number } | Fail> {
  try {
    await requirePermission("boq", "create");
    const custCode = cleanText(payload?.cust_code);
    const projectId = cleanText(payload?.project_id);
    const username = cleanText(payload?.username);
    const contractRef = cleanText(payload?.contract_no);
    const docDate = parseDocDate(payload?.doc_date);
    const items = Array.isArray(payload?.items) ? payload.items : [];

    if (!custCode) return fail("Missing cust_code");
    if (!projectId) return fail("Missing project_id");
    if (!contractRef) return fail("Missing contract_no");

    const validItems = items
      .map((item: any) => ({
        item_code: cleanText(item?.productId || item?.item_code || item?.code),
        item_name: cleanText(item?.productName || item?.item_name || item?.name_1),
        qty: toNumber(item?.quantity ?? item?.qty, 0),
        unit_code: cleanText(item?.unit || item?.unit_code),
      }))
      // item_code is optional — labour / consumable lines are free-text rows.
      .filter((item: any) => item.item_name && item.qty > 0);

    if (!validItems.length) return fail("Missing valid BOQ items");

    const result = await withTransaction(async (client) => {
      const contractResult = await client.query(
        `
          SELECT roworder, contract_no
          FROM odg_projects_contract
          WHERE project_id = $1
            AND (roworder = NULLIF($2, '')::int OR contract_no = $3)
          LIMIT 1
        `,
        [projectId, /^\d+$/.test(contractRef) ? contractRef : "", contractRef],
      );
      let contract = contractResult.rows[0];

      // Bridge: this project may have a v2 contract (odg_contract, created via
      // /contract/new) but no legacy ERP contract yet. The ERP BOQ pipeline needs
      // an odg_projects_contract row, so mirror the v2 contract into it once.
      if (!contract) {
        const v2 = await client.query(
          `SELECT contract_no, project_name, total_amount
             FROM odg_contract
            WHERE project_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
          [projectId],
        );
        const v = v2.rows[0];
        if (v) {
          const ins = await client.query(
            `INSERT INTO odg_projects_contract
               (project_id, contract_name, contract_no, contract_date, cust_code, amount,
                approve_status_1, approve_status_2, acc_approve, created_at)
             VALUES ($1, $2, $3, NOW(), $4, $5, 0, 0, 0, NOW())
             RETURNING roworder, contract_no`,
            [projectId, v.project_name || null, v.contract_no || contractRef || null, custCode || null, toNumber(v.total_amount, 0)],
          );
          contract = ins.rows[0];
        }
      }

      const contractId = toNumber(contract?.roworder, 0);

      if (!contractId) return { missingContract: true, doc_no: null };

      // One contract may have multiple BOQ documents — no duplicate guard here.
      const docNo = await nextBoqDocNo(client, docMonthKey(docDate));

      await client.query(
        `
          INSERT INTO odg_projects_boq (
            doc_no, doc_date, cust_code, project_id, user_created, approve_status, contract_id
          ) VALUES ($1, $2, $3, $4, $5, 0, $6)
        `,
        [docNo, docDate, custCode, projectId, username || null, contractId],
      );

      for (const item of validItems) {
        await client.query(
          `
            INSERT INTO odg_projects_boq_detail (
              doc_no, doc_date, cust_code, item_code, item_name, qty, unit_code, contract_id, project_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [docNo, docDate, custCode, item.item_code || null, item.item_name, item.qty, item.unit_code || null, contractId, toNumber(projectId, 0) || null],
        );
      }

      return { doc_no: docNo };
    });

    if (result.missingContract) return fail("ບໍ່ພົບສັນຍາສຳລັບອອກ BOQ");

    await logActivity("boq", String(result.doc_no ?? ""), "ສ້າງ BOQ", result.doc_no ?? undefined);
    invalidate("projects:");
    return {
      success: true,
      message: `Created ${result.doc_no}`,
      doc_no: result.doc_no!,
      total_items: validItems.length,
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Edit an existing ERP BOQ: keep the header (doc_no, contract, customer) and
 * fully replace its detail rows. Materials, labour and consumables are all just
 * line items (qty only — the ERP BOQ carries no price).
 */
export async function updateBoqErp(
  docNo: string,
  payload: { items?: unknown[] },
): Promise<{ success: true; doc_no: string; total_items: number } | Fail> {
  try {
    await requirePermission("boq", "edit");
    const decodedDocNo = decodeURIComponent(docNo);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const validItems = items
      .map((item: any) => ({
        item_code: cleanText(item?.productId || item?.item_code || item?.code),
        item_name: cleanText(item?.productName || item?.item_name || item?.name_1),
        qty: toNumber(item?.quantity ?? item?.qty, 0),
        unit_code: cleanText(item?.unit || item?.unit_code),
      }))
      .filter((item: any) => item.item_name && item.qty > 0);

    if (!validItems.length) return fail("Missing valid BOQ items");

    const result = await withTransaction(async (client) => {
      const head = await client.query(
        `SELECT doc_date, cust_code, contract_id, project_id, COALESCE(approve_status, 0)::int AS approve_status
           FROM odg_projects_boq WHERE doc_no = $1 LIMIT 1`,
        [decodedDocNo],
      );
      const h = head.rows[0];
      if (!h) return { notFound: true as const, resubmitted: false as const };

      // Fixing a REJECTED BOQ (approve_status = 2) sends it back into the
      // approval queue (0 = ລໍຖ້າອະນຸມັດ). Decided server-side — the form has no
      // say in it. An approved (1) or pending (0) BOQ keeps its state.
      const wasRejected = Number(h.approve_status) === 2;
      if (wasRejected) {
        await client.query(
          `UPDATE odg_projects_boq SET approve_status = 0, approver = NULL WHERE doc_no = $1`,
          [decodedDocNo],
        );
      }

      await client.query(`DELETE FROM odg_projects_boq_detail WHERE doc_no = $1`, [decodedDocNo]);
      for (const item of validItems) {
        await client.query(
          `
            INSERT INTO odg_projects_boq_detail (
              doc_no, doc_date, cust_code, item_code, item_name, qty, unit_code, contract_id, project_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [decodedDocNo, h.doc_date, h.cust_code, item.item_code || null, item.item_name, item.qty, item.unit_code || null, h.contract_id, h.project_id],
        );
      }
      return { notFound: false as const, resubmitted: wasRejected };
    });

    if (result.notFound) return fail("ບໍ່ພົບ BOQ");
    await logActivity("boq", decodedDocNo, "ແກ້ໄຂ BOQ");
    if (result.resubmitted) await logActivity("boq", decodedDocNo, "ສົ່ງ BOQ ອະນຸມັດໃໝ່");
    invalidate("projects:");
    return { success: true, doc_no: decodedDocNo, total_items: validItems.length };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function approveBoq(docNo: string, payload: { status?: number; username?: string }): Promise<Ok | Fail> {
  try {
    const decodedDocNo = decodeURIComponent(docNo);
    const status = toNumber(payload?.status, 0);
    const username = payload?.username ? String(payload.username) : null;

    // The FIRST BOQ of a contract needs the base boq "approve" permission.
    // Subsequent (2nd+) BOQ of a contract may only be approved/rejected by an
    // admin OR a user explicitly granted the boq "approve_next" permission.
    const sessionUser = await getSessionUser();
    const firstBoq = await isFirstBoqForContract(decodedDocNo);
    if (firstBoq) {
      await requirePermission("boq", "approve");
    } else if (!isAdmin(sessionUser) && !can(sessionUser, "boq", "approve_next")) {
      return fail("ໃບ BOQ ທີ 2 ຂຶ້ນໄປ ຕ້ອງໃຫ້ຜູ້ດູແລລະບົບ ຫຼື ຜູ້ມີສິດອະນຸມັດໃບຕໍ່ໄປເທົ່ານັ້ນ");
    }

    await query(
      `UPDATE odg_projects_boq SET approve_status = $1, approver = $2 WHERE doc_no = $3`,
      [status, username, decodedDocNo],
    );
    await logActivity("boq", decodedDocNo, status > 0 ? "ອະນຸມັດ BOQ" : "ຍົກເລີກການອະນຸມັດ BOQ");

    // On approval, seed the standard installation task checklist into the
    // project's plan (idempotent — runs once per project). Best-effort: a
    // seeding failure must not block the approval itself.
    if (status > 0) {
      try {
        const pr = await query(
          `SELECT project_id, contract_id FROM odg_projects_boq WHERE doc_no = $1 LIMIT 1`,
          [decodedDocNo],
        );
        const projectId = pr.rows[0]?.project_id ? String(pr.rows[0].project_id) : "";
        const contractId = pr.rows[0]?.contract_id != null ? String(pr.rows[0].contract_id) : null;
        if (projectId) {
          const n = await seedStandardInstallTasks(projectId, contractId);
          if (n > 0) {
            await logActivity("boq", decodedDocNo, `ສ້າງລາຍການງານຕິດຕັ້ງມາດຕະຖານ ${n} ລາຍການ`);
            invalidate("tasks:");
          }
        }
      } catch (e) {
        console.error("seedStandardInstallTasks failed:", (e as Error).message);
      }
    }

    invalidate("projects:");
    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}

export async function checkAccountingApprove(contractNo: string, payload: { username?: string; project_id?: string }): Promise<Ok | Fail> {
  try {
    const updated = await approveAccounting(cleanText(contractNo), {
      username: payload?.username,
      projectId: payload?.project_id,
    });
    if (!updated) return fail("Contract not found");
    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}
