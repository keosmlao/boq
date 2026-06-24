"use server";

import { query, withTransaction } from "@/_lib/db";
import { invalidate } from "@/_lib/cache";
import { logActivity } from "./chatter";
import { dateOrNull, ensureContractSchema, generateContractNo, num } from "@/_lib/schemas/contracts";

type Fail = { success: false; message: string; [k: string]: unknown };

function fail(message: string, extra: Record<string, unknown> = {}): Fail {
  return { success: false, message, ...extra };
}

export async function getContracts(opts: { projectId?: string; quotationId?: string; status?: string; search?: string } = {}): Promise<{ success: true; data: unknown[] } | Fail> {
  try {
    await ensureContractSchema();
    const conds: string[] = [];
    const params: unknown[] = [];
    if (opts.projectId) { params.push(opts.projectId); conds.push(`project_id = $${params.length}`); }
    if (opts.quotationId) { params.push(opts.quotationId); conds.push(`quotation_id = $${params.length}`); }
    if (opts.status && opts.status !== "all") { params.push(opts.status); conds.push(`status = $${params.length}`); }
    if (opts.search) {
      params.push(`%${opts.search}%`);
      conds.push(`(contract_no ILIKE $${params.length} OR project_name ILIKE $${params.length} OR customer_name ILIKE $${params.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const result = await query(`SELECT * FROM odg_contract ${where} ORDER BY created_at DESC LIMIT 500`, params);
    return { success: true, data: result.rows };
  } catch (e) { return fail((e as Error).message); }
}

/**
 * All contracts for the cross-project list — merges v2 (odg_contract) with the
 * legacy ERP table (odg_projects_contract). Legacy read is defensive (SELECT *)
 * so unknown columns can't break it; if it fails, v2 still shows.
 */
export async function getAllContractsForList(): Promise<{ success: true; data: any[] } | Fail> {
  try {
    await ensureContractSchema();
    const v2 = await query(
      `SELECT id, contract_no, project_name, customer_name, project_id::text AS project_id,
              total_amount, created_at, sales_approved, accounting_approved
       FROM odg_contract ORDER BY created_at DESC LIMIT 500`,
    );
    const rows: any[] = v2.rows.map((c: any) => ({ ...c, src: "v2" }));

    try {
      const legacy = await query(
        `SELECT c.*, p.project_name AS p_project_name, ac.name_1 AS cust_name
         FROM odg_projects_contract c
         LEFT JOIN odg_projects p ON p.id::text = c.project_id::text
         LEFT JOIN ar_customer ac ON ac.code = c.cust_code
         ORDER BY c.roworder DESC LIMIT 500`,
      );
      for (const c of legacy.rows as any[]) {
        rows.push({
          contract_no: c.contract_no,
          project_name: c.p_project_name || c.contract_name || null,
          customer_name: c.cust_name || c.cust_code || null,
          project_id: c.project_id != null ? String(c.project_id) : "",
          created_at: c.created_at,
          sales_approved: Number(c.approve_status_1) === 1,
          accounting_approved: Math.max(Number(c.approve_status_2) || 0, Number(c.acc_approve) || 0) === 1,
          src: "erp",
        });
      }
    } catch {
      /* legacy table/columns differ — keep v2 only */
    }
    return { success: true, data: rows };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Create a contract DIRECTLY in the ERP table `odg_projects_contract` (+ its
 * detail), so the BOQ pipeline (which reads odg_projects_contract) finds it with
 * no bridging. Customer code is taken from the project (odg_projects.sml_code).
 */
export async function createContract(body: any, opts: { fromQuotation?: string } = {}): Promise<{ success: true; data: unknown } | Fail> {
  try {
    let items: any[] = [];
    if (opts.fromQuotation) {
      const q = await query(`SELECT * FROM odg_quotation WHERE id = $1`, [opts.fromQuotation]);
      if (!q.rows.length) return fail("Quotation not found");
      const src = q.rows[0];
      if (src.status !== "ອະນຸມັດແລ້ວ") return fail("Only approved quotations can be converted to contracts");
      body = { ...src, ...body, quotation_id: src.id };
      const raw = (src as any).items;
      items = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(raw || "[]"); } catch { return []; } })();
    }
    if (!body.contract_no) body.contract_no = generateContractNo();

    const projectId = body.project_id ? String(body.project_id) : "";
    if (!projectId) return fail("Missing project_id");

    // Enforce 1 project = 1 contract (ERP table).
    const dup = await query(`SELECT roworder FROM odg_projects_contract WHERE project_id = $1 LIMIT 1`, [projectId]);
    if (dup.rows.length) {
      return fail("ໂຄງການນີ້ມີສັນຍາແລ້ວ (1 ໂຄງການ = 1 ສັນຍາ)", { contract_id: dup.rows[0].roworder });
    }

    // Customer code from the project.
    const pr = await query(`SELECT sml_code FROM odg_projects WHERE id = $1 LIMIT 1`, [projectId]);
    const custCode = ((pr.rows[0] as any)?.sml_code ?? body.cust_code) || null;

    const data = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO odg_projects_contract
           (project_id, quotation_id, contract_name, contract_no, contract_date, cust_code,
            amount, payment_type, start_date, end_date, approve_status_1, approve_status_2, acc_approve, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0, 0, NOW())
         RETURNING roworder, contract_no, project_id, cust_code, amount`,
        [
          projectId,
          body.quotation_id ? Number(body.quotation_id) : null,
          body.project_name || null,
          String(body.contract_no),
          dateOrNull(body.sign_date),
          custCode,
          num(body.total_amount),
          body.payment_terms || null,
          dateOrNull(body.start_date),
          dateOrNull(body.end_date),
        ],
      );
      const row = ins.rows[0];
      for (const it of items) {
        const amount = it.total != null ? num(it.total) : num(it.qty) * num(it.unit_price ?? it.price);
        await client.query(
          `INSERT INTO odg_projects_contract_detail
             (project_id, contract_date, item_code, item_name, amount, created_date_time_now, contract_no)
           VALUES ($1, NOW(), $2, $3, $4, NOW(), $5)`,
          [projectId, it.item_code || it.code || null, it.description || it.item_name || it.name || "", amount, row.contract_no],
        );
      }

      // Payment installments (e.g. งวด 1 = ຄ່າແອ, งวด 2 = ຄ່າຕິດຕັ້ງ). Stored in
      // odg_projects_item so the contract detail's installment schedule shows them.
      const installments = Array.isArray(body.installments) ? body.installments : [];
      for (const inst of installments) {
        const amt = num(inst.total_amount);
        if (!(amt > 0)) continue;
        await client.query(
          `INSERT INTO odg_projects_item
             (project_id, contract_no, installment_no, total_amount, items, created_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
          [
            num(projectId),
            row.contract_no,
            num(inst.installment_no),
            amt,
            JSON.stringify([{ description: inst.label || "", amount: amt }]),
          ],
        );
      }
      return row;
    });

    invalidate("projects:");
    return { success: true, data };
  } catch (e) { return fail((e as Error).message); }
}

/** Read a legacy ERP contract (odg_projects_contract) by contract_no, defensively. */
export async function getLegacyContract(contractNo: string): Promise<{ success: true; data: any } | Fail> {
  try {
    const r = await query(
      `SELECT c.*, p.project_name AS p_project_name
       FROM odg_projects_contract c
       LEFT JOIN odg_projects p ON p.id::text = c.project_id::text
       WHERE c.contract_no = $1 LIMIT 1`,
      [decodeURIComponent(contractNo)],
    );
    if (!r.rows.length) return fail("Contract not found");
    const c: any = r.rows[0];
    return {
      success: true,
      data: {
        ...c,
        project_name: c.p_project_name || c.contract_name || null,
        customer_name: c.cust_code || null,
        sales_approved: Number(c.approve_status_1) === 1,
        sales_approver: c.approver_1 || null,
        accounting_approved: Math.max(Number(c.approve_status_2) || 0, Number(c.acc_approve) || 0) === 1,
        accounting_approver: c.approver_2 || c.acc_approver || null,
        src: "erp",
      },
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getContract(id: string): Promise<Record<string, unknown> | Fail> {
  try {
    await ensureContractSchema();
    const result = await query(`SELECT * FROM odg_contract WHERE id = $1 LIMIT 1`, [id]);
    if (!result.rows.length) return fail("Contract not found");
    return result.rows[0];
  } catch (e) { return fail((e as Error).message); }
}

export async function updateContract(id: string, body: any): Promise<{ success: true; data: unknown } | Fail> {
  try {
    await ensureContractSchema();
    const result = await query(
      `UPDATE odg_contract SET
        contract_no = COALESCE($2, contract_no),
        project_id = $3, project_name = $4, customer_name = $5,
        customer_address = $6, customer_phone = $7,
        sign_date = $8, start_date = $9, end_date = $10, payment_terms = $11,
        discount = $12, tax = $13, tax_type = $14, subtotal = $15, total_amount = $16,
        notes = $17, status = COALESCE($18, status),
        items = $19, contract_pdf_url = $20, updated_at = now()
      WHERE id = $1 RETURNING *`,
      [
        id,
        body.contract_no || null,
        body.project_id ? String(body.project_id) : null,
        body.project_name || null,
        body.customer_name || null,
        body.customer_address || null,
        body.customer_phone || null,
        dateOrNull(body.sign_date),
        dateOrNull(body.start_date),
        dateOrNull(body.end_date),
        body.payment_terms || null,
        num(body.discount),
        num(body.tax),
        body.tax_type || "0",
        num(body.subtotal),
        num(body.total_amount),
        body.notes || null,
        body.status || null,
        JSON.stringify(Array.isArray(body.items) ? body.items : []),
        body.contract_pdf_url || null,
      ],
    );
    if (!result.rows.length) return fail("Contract not found");
    invalidate("projects:");
    return { success: true, data: result.rows[0] };
  } catch (e) { return fail((e as Error).message); }
}

export async function deleteContract(id: string): Promise<{ success: true } | Fail> {
  try {
    await ensureContractSchema();
    const result = await query(`DELETE FROM odg_contract WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows.length) return fail("Contract not found");
    invalidate("projects:");
    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}

/**
 * Set ONE approval step (sales manager or accounting) — only touches that
 * flag, never the rest of the contract. When both are approved, mark status
 * active; otherwise revert to awaiting.
 */
export async function setContractApproval(
  id: string,
  which: "sales" | "accounting",
  approved: boolean,
  approver?: string,
): Promise<{ success: true } | Fail> {
  try {
    await ensureContractSchema();
    // Enforce step order: accounting can only approve after sales has approved.
    if (which === "accounting" && approved) {
      const chk = await query(`SELECT sales_approved FROM odg_contract WHERE id = $1`, [id]);
      if (!chk.rows.length) return fail("Contract not found");
      if (!chk.rows[0].sales_approved) return fail("ຝ່າຍຂາຍຍັງບໍ່ໄດ້ອະນຸມັດ");
    }
    const col = which === "sales" ? "sales_approved" : "accounting_approved";
    const who = which === "sales" ? "sales_approver" : "accounting_approver";
    const result = await query(
      `UPDATE odg_contract
         SET ${col} = $2,
             ${who} = $3,
             status = CASE
               WHEN ${which === "sales" ? "accounting_approved" : "sales_approved"} AND $2 THEN 'active'
               ELSE 'awaiting'
             END,
             updated_at = now()
       WHERE id = $1 RETURNING id`,
      [id, approved, approver || null],
    );
    if (!result.rows.length) return fail("Contract not found");
    await logActivity("contract", id, `${approved ? "ອະນຸມັດ" : "ຍົກເລີກອະນຸມັດ"} (${which === "sales" ? "ຝ່າຍຂາຍ" : "ບັນຊີ"})`);
    invalidate("projects:");
    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}
