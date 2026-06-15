"use server";

import { query, withTransaction } from "@/_lib/db";
import { cleanText, dateOrNull, ensureRequestsSchema, generateRequestDocNo, num } from "@/_lib/schemas/requests";

type Fail = { success: false; message: string };
function fail(message: string): Fail { return { success: false, message }; }

// Material request (ໃບຂໍເບີກ) — ERP convention.
const IC_TRANS_REQUEST_TYPE = 3;
const IC_TRANS_REQUEST_FLAG = 122;

/** Mirror a material request into ic_trans + ic_trans_detail so the ERP picks
 *  it up alongside odg_requests. Uses the same doc_no for both systems. */
async function syncRequestToIcTrans(client: any, opts: {
  docNo: string;
  docDate: string;
  docRef?: string | null;
  custCode?: string | null;
  whFrom?: string | null;
  locationFrom?: string | null;
  creatorCode?: string | null;
  remark?: string | null;
  items: Array<{ item_code: string | null; item_name: string | null; unit_code: string | null; qty: number; remark: string | null }>;
}) {
  await client.query(`DELETE FROM ic_trans_detail WHERE doc_no = $1 AND trans_type = $2 AND trans_flag = $3`,
    [opts.docNo, IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG]);
  await client.query(`DELETE FROM ic_trans WHERE doc_no = $1 AND trans_type = $2 AND trans_flag = $3`,
    [opts.docNo, IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG]);

  await client.query(
    `INSERT INTO ic_trans (
      trans_type, trans_flag, doc_date, doc_no, doc_ref,
      cust_code, wh_from, location_from,
      creator_code, user_request, remark, doc_success
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,0)`,
    [
      IC_TRANS_REQUEST_TYPE,
      IC_TRANS_REQUEST_FLAG,
      opts.docDate,
      opts.docNo,
      opts.docRef || "",
      opts.custCode || "",
      opts.whFrom || "",
      opts.locationFrom || "",
      opts.creatorCode || "",
      opts.remark || "",
    ],
  );

  for (let i = 0; i < opts.items.length; i++) {
    const it = opts.items[i];
    if (!(Number(it.qty) > 0)) continue;
    await client.query(
      `INSERT INTO ic_trans_detail (
        trans_type, trans_flag, doc_date, doc_no, doc_ref, cust_code,
        item_code, item_name, unit_code, qty,
        wh_code, shelf_code, line_number, remark
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        IC_TRANS_REQUEST_TYPE,
        IC_TRANS_REQUEST_FLAG,
        opts.docDate,
        opts.docNo,
        opts.docRef || "",
        opts.custCode || "",
        it.item_code || "",
        it.item_name || "",
        it.unit_code || "",
        Number(it.qty) || 0,
        opts.whFrom || "",
        opts.locationFrom || "",
        i + 1,
        it.remark || "",
      ],
    );
  }
}

export async function getRequests(opts: { status?: string; projectId?: string } = {}): Promise<unknown[]> {
  await ensureRequestsSchema();
  const status = opts.status || "all";
  const conds: string[] = [];
  const params: unknown[] = [];
  if (status === "0" || status === "1") {
    params.push(Number(status));
    conds.push(`r.doc_success = $${params.length}`);
  }
  if (opts.projectId) {
    params.push(Number(opts.projectId));
    conds.push(`r.project_id = $${params.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  const result = await query(
    `
    SELECT
      r.doc_no, r.doc_date, r.doc_ref, r.project_id, r.contract_no, r.cust_code,
      r.wh_from, r.location_from, r.creator_code, r.requester_name, r.remark,
      r.doc_success, r.withdraw_doc_no, r.withdraw_date, r.created_at,
      p.project_name,
      COALESCE((
        SELECT json_agg(json_build_object(
          'item_code', d.item_code,
          'item_name', d.item_name,
          'unit_code', d.unit_code,
          'qty', d.qty,
          'remark', d.remark
        ) ORDER BY d.line_no, d.id)
        FROM odg_requests_detail d
        WHERE d.doc_no = r.doc_no
      ), '[]'::json) AS list,
      CASE WHEN r.withdraw_doc_no IS NOT NULL THEN 1 ELSE 0 END AS withdraw_count,
      CASE WHEN r.withdraw_doc_no IS NOT NULL
        THEN ARRAY[r.withdraw_doc_no]::text[] ELSE ARRAY[]::text[] END AS withdraw_docs,
      CASE WHEN wd.first_date IS NOT NULL
        THEN ARRAY[to_char(wd.first_date, 'YYYY-MM-DD')]::text[] ELSE ARRAY[]::text[] END AS withdraw_dates,
      CASE WHEN wd.users IS NOT NULL
        THEN ARRAY[wd.users]::text[] ELSE ARRAY[]::text[] END AS withdraw_names,
      CASE WHEN wd.wh_names IS NOT NULL
        THEN ARRAY[wd.wh_names]::text[] ELSE ARRAY[]::text[] END AS withdraw_wh_labels,
      CASE WHEN wd.shelf_names IS NOT NULL
        THEN ARRAY[wd.shelf_names]::text[] ELSE ARRAY[]::text[] END AS withdraw_location_labels
    FROM odg_requests r
    LEFT JOIN odg_projects p ON p.id = r.project_id
    LEFT JOIN LATERAL (
      SELECT
        MIN(w.doc_date) AS first_date,
        STRING_AGG(DISTINCT w.createuser, ', ') AS users,
        STRING_AGG(DISTINCT w.wh_name, ', ') AS wh_names,
        STRING_AGG(DISTINCT w.shelf_name, ', ') AS shelf_names
      FROM odg_withdraw_info w
      WHERE w.doc_no = r.withdraw_doc_no
    ) wd ON r.withdraw_doc_no IS NOT NULL
    ${where}
    ORDER BY r.doc_date DESC, r.doc_no DESC
    LIMIT 1000
    `,
    params,
  );
  return result.rows;
}

export async function createRequest(body: any): Promise<{ success: true; doc_no: string; data: { doc_no: string } } | Fail> {
  try {
    await ensureRequestsSchema();
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) return fail("At least one item is required");

    const docNo = cleanText(body.doc_no) || (await generateRequestDocNo());
    const docDate = dateOrNull(body.doc_date) || new Date().toISOString().slice(0, 10);
    const docRef = cleanText(body.doc_ref);
    const custCode = cleanText(body.cust_code);
    const whFrom = cleanText(body.wh_from || body.warehouse_code);
    const locationFrom = cleanText(body.location_from || body.location_code);
    const creatorCode = cleanText(body.creator_code);
    const remark = cleanText(body.remark);

    const normalizedItems = items.map((it: any) => ({
      item_code: cleanText(it.item_code),
      item_name: cleanText(it.item_name),
      unit_code: cleanText(it.unit_code),
      qty: num(it.qty),
      remark: cleanText(it.remark),
    }));

    await withTransaction(async (client: any) => {
      await client.query(
        `INSERT INTO odg_requests (
          doc_no, doc_date, doc_ref, project_id, contract_no, cust_code,
          wh_from, location_from, creator_code, requester_name, remark,
          doc_success, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,now(),now())`,
        [
          docNo, docDate, docRef,
          body.project_id ? Number(body.project_id) : null,
          cleanText(body.contract_no), custCode,
          whFrom, locationFrom, creatorCode,
          cleanText(body.requester_name), remark,
        ],
      );

      for (let i = 0; i < normalizedItems.length; i++) {
        const it = normalizedItems[i];
        await client.query(
          `INSERT INTO odg_requests_detail (doc_no, line_no, item_code, item_name, unit_code, qty, remark) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [docNo, i + 1, it.item_code, it.item_name, it.unit_code, it.qty, it.remark],
        );
      }

      await syncRequestToIcTrans(client, {
        docNo, docDate, docRef, custCode,
        whFrom, locationFrom, creatorCode, remark,
        items: normalizedItems,
      });
    });

    return { success: true, doc_no: docNo, data: { doc_no: docNo } };
  } catch (e) { return fail((e as Error).message); }
}

/** Edit a legacy request in place (preserve doc_no, re-sync ic_trans). Blocks if already withdrawn. */
export async function updateRequest(docNo: string, body: any): Promise<{ success: true; doc_no: string } | Fail> {
  try {
    await ensureRequestsSchema();
    const decoded = decodeURIComponent(docNo);
    const ex = await query(
      `SELECT doc_date, doc_ref, cust_code, wh_from, location_from, creator_code, doc_success FROM odg_requests WHERE doc_no = $1 LIMIT 1`,
      [decoded],
    );
    if (!ex.rows.length) return fail("Request not found");
    if (Number(ex.rows[0].doc_success) === 1) return fail("ALREADY_WITHDRAWN");
    const head: any = ex.rows[0];

    const items = (Array.isArray(body?.items) ? body.items : [])
      .map((it: any) => ({
        item_code: cleanText(it.item_code),
        item_name: cleanText(it.item_name ?? it.description),
        unit_code: cleanText(it.unit_code ?? it.unit),
        qty: num(it.qty),
        remark: cleanText(it.remark),
      }))
      .filter((it: any) => it.qty > 0);
    if (!items.length) return fail("At least one item is required");
    const remark = cleanText(body.remark ?? body.notes);

    await withTransaction(async (client: any) => {
      await client.query(`UPDATE odg_requests SET remark = $2, updated_at = now() WHERE doc_no = $1`, [decoded, remark]);
      await client.query(`DELETE FROM odg_requests_detail WHERE doc_no = $1`, [decoded]);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO odg_requests_detail (doc_no, line_no, item_code, item_name, unit_code, qty, remark) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [decoded, i + 1, it.item_code, it.item_name, it.unit_code, it.qty, it.remark],
        );
      }
      await syncRequestToIcTrans(client, {
        docNo: decoded,
        docDate: head.doc_date,
        docRef: head.doc_ref,
        custCode: head.cust_code,
        whFrom: head.wh_from,
        locationFrom: head.location_from,
        creatorCode: head.creator_code,
        remark,
        items,
      });
    });
    return { success: true, doc_no: decoded };
  } catch (e) { return fail((e as Error).message); }
}

export async function deleteRequest(docNo: string): Promise<{ success: true; message: string } | Fail> {
  try {
    await ensureRequestsSchema();
    const decoded = decodeURIComponent(docNo);
    const existing = await query(`SELECT doc_success FROM odg_requests WHERE doc_no = $1 LIMIT 1`, [decoded]);
    if (!existing.rows.length) return fail("Request not found");
    if (Number(existing.rows[0].doc_success) === 1) return fail("ALREADY_WITHDRAWN");
    await withTransaction(async (client: any) => {
      await client.query(`DELETE FROM odg_requests WHERE doc_no = $1`, [decoded]);
      await client.query(`DELETE FROM ic_trans_detail WHERE doc_no = $1 AND trans_type = $2 AND trans_flag = $3`,
        [decoded, IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG]);
      await client.query(`DELETE FROM ic_trans WHERE doc_no = $1 AND trans_type = $2 AND trans_flag = $3`,
        [decoded, IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG]);
    });
    return { success: true, message: "Deleted" };
  } catch (e) { return fail((e as Error).message); }
}

// Spare-part request: same as createRequest but accepts the BoqRequestModal payload shape
export async function createSparepartRequest(body: any): Promise<{ success: true; doc_no: string } | Fail> {
  try {
    await ensureRequestsSchema();
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) return fail("At least one item is required");

    const docNo = cleanText(body.doc_no) || (await generateRequestDocNo());
    const docDate = dateOrNull(body.doc_date) || new Date().toISOString().slice(0, 10);
    const docRef = cleanText(body.doc_ref);
    const custCode = cleanText(body.cust_code);
    const whFrom = cleanText(body.warehouse_code || body.wh_from);
    const locationFrom = cleanText(body.location_code || body.location_from);
    const creatorCode = cleanText(body.creator_code || body.requester);
    const remark = cleanText(body.remark);

    let projectId: number | null = body.project_id ? Number(body.project_id) : null;
    if (!projectId && docRef) {
      const r = await query(`SELECT project_id FROM odg_projects_boq WHERE doc_no = $1 LIMIT 1`, [docRef]);
      if (r.rows.length) projectId = Number(r.rows[0].project_id) || null;
    }

    const normalizedItems = items
      .map((it: any) => ({
        item_code: cleanText(it.item_code),
        item_name: cleanText(it.item_name),
        unit_code: cleanText(it.unit_code),
        qty: num(it.qty),
        remark: cleanText(it.remark),
      }))
      .filter((it) => it.qty > 0);

    await withTransaction(async (client: any) => {
      await client.query(
        `INSERT INTO odg_requests (
          doc_no, doc_date, doc_ref, project_id, contract_no, cust_code,
          wh_from, location_from, creator_code, requester_name, remark,
          doc_success, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,now(),now())
        ON CONFLICT (doc_no) DO NOTHING`,
        [
          docNo, docDate, docRef, projectId,
          cleanText(body.contract_no), custCode,
          whFrom, locationFrom, creatorCode,
          cleanText(body.requester_name || body.requester),
          remark,
        ],
      );

      await client.query(`DELETE FROM odg_requests_detail WHERE doc_no = $1`, [docNo]);
      for (let i = 0; i < normalizedItems.length; i++) {
        const it = normalizedItems[i];
        await client.query(
          `INSERT INTO odg_requests_detail (doc_no, line_no, item_code, item_name, unit_code, qty, remark) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [docNo, i + 1, it.item_code, it.item_name, it.unit_code, it.qty, it.remark],
        );
      }

      await syncRequestToIcTrans(client, {
        docNo, docDate, docRef, custCode,
        whFrom, locationFrom, creatorCode, remark,
        items: normalizedItems,
      });
    });

    return { success: true, doc_no: docNo };
  } catch (e) { return fail((e as Error).message); }
}

export async function getSparepartRequest(docNo: string): Promise<Record<string, unknown> | Fail> {
  try {
    await ensureRequestsSchema();
    const decoded = decodeURIComponent(docNo);
    const header = await query(
      `SELECT r.doc_no, r.doc_date, r.doc_ref, r.project_id, r.contract_no, r.cust_code,
              r.wh_from, r.location_from, r.creator_code, r.requester_name, r.remark,
              r.doc_success, r.withdraw_doc_no, r.withdraw_date, r.created_at, r.updated_at,
              p.project_name
       FROM odg_requests r
       LEFT JOIN odg_projects p ON p.id = r.project_id
       WHERE r.doc_no = $1 LIMIT 1`,
      [decoded],
    );
    if (!header.rows.length) return fail("Request not found");
    const items = await query(
      `SELECT line_no, item_code, item_name, unit_code, qty, remark
       FROM odg_requests_detail WHERE doc_no = $1 ORDER BY line_no, id`,
      [decoded],
    );
    return { ...header.rows[0], items: items.rows };
  } catch (e) { return fail((e as Error).message); }
}

export async function updateSparepartRequest(docNo: string, body: any): Promise<{ success: true; message: string } | Fail> {
  try {
    await ensureRequestsSchema();
    const decoded = decodeURIComponent(docNo);
    const existing = await query(
      `SELECT doc_success, doc_date, doc_ref, cust_code, wh_from, location_from, creator_code, remark
       FROM odg_requests WHERE doc_no = $1 LIMIT 1`,
      [decoded],
    );
    if (!existing.rows.length) return fail("Request not found");
    if (Number(existing.rows[0].doc_success) === 1) return fail("ALREADY_WITHDRAWN");
    const prev = existing.rows[0];

    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    const newDocDate = dateOrNull(body.doc_date) || prev.doc_date;
    const newRemark = cleanText(body.remark);
    const newWh = cleanText(body.warehouse_code || body.wh_from);
    const newLoc = cleanText(body.location_code || body.location_from);

    const normalizedItems = items
      .map((it: any) => ({
        item_code: cleanText(it.item_code),
        item_name: cleanText(it.item_name),
        unit_code: cleanText(it.unit_code),
        qty: num(it.qty),
        remark: cleanText(it.remark),
      }))
      .filter((it) => it.qty > 0);

    await withTransaction(async (client: any) => {
      await client.query(
        `UPDATE odg_requests SET
          doc_date = COALESCE($2, doc_date),
          remark = $3, wh_from = $4, location_from = $5, updated_at = now()
         WHERE doc_no = $1`,
        [decoded, newDocDate, newRemark, newWh, newLoc],
      );

      await client.query(`DELETE FROM odg_requests_detail WHERE doc_no = $1`, [decoded]);
      for (let i = 0; i < normalizedItems.length; i++) {
        const it = normalizedItems[i];
        await client.query(
          `INSERT INTO odg_requests_detail (doc_no, line_no, item_code, item_name, unit_code, qty, remark) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [decoded, i + 1, it.item_code, it.item_name, it.unit_code, it.qty, it.remark],
        );
      }

      const docDateStr = typeof newDocDate === "string"
        ? newDocDate
        : new Date(newDocDate).toISOString().slice(0, 10);
      await syncRequestToIcTrans(client, {
        docNo: decoded,
        docDate: docDateStr,
        docRef: prev.doc_ref,
        custCode: prev.cust_code,
        whFrom: newWh || prev.wh_from,
        locationFrom: newLoc || prev.location_from,
        creatorCode: prev.creator_code,
        remark: newRemark || prev.remark,
        items: normalizedItems,
      });
    });

    return { success: true, message: "Updated" };
  } catch (e) { return fail((e as Error).message); }
}

export async function getNextRequestDocNo(): Promise<{ success: true; doc_no: string }> {
  await ensureRequestsSchema();
  const docNo = await generateRequestDocNo();
  return { success: true, doc_no: docNo };
}
