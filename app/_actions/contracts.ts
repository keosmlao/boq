"use server";

import { query } from "@/_lib/db";
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

export async function createContract(body: any, opts: { fromQuotation?: string } = {}): Promise<{ success: true; data: unknown } | Fail> {
  try {
    await ensureContractSchema();
    if (opts.fromQuotation) {
      const q = await query(`SELECT * FROM odg_quotation WHERE id = $1`, [opts.fromQuotation]);
      if (!q.rows.length) return fail("Quotation not found");
      const src = q.rows[0];
      if (src.status !== "ອະນຸມັດແລ້ວ") return fail("Only approved quotations can be converted to contracts");
      const existing = await query(`SELECT id FROM odg_contract WHERE quotation_id = $1 LIMIT 1`, [opts.fromQuotation]);
      if (existing.rows.length) return fail("Contract already exists for this quotation", { contract_id: existing.rows[0].id });
      body = { ...src, ...body, quotation_id: src.id, contract_no: body.contract_no || generateContractNo(), status: "draft" };
    }
    if (!body.contract_no) body.contract_no = generateContractNo();

    const result = await query(
      `INSERT INTO odg_contract (
        contract_no, quotation_id, project_id, project_name,
        customer_name, customer_address, customer_phone,
        sign_date, start_date, end_date, payment_terms,
        discount, tax, tax_type, subtotal, total_amount,
        notes, status, items, contract_pdf_url
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        String(body.contract_no),
        body.quotation_id ? Number(body.quotation_id) : null,
        body.project_id ? String(body.project_id) : null,
        body.project_name || null,
        body.customer_name || null,
        body.customer_address || null,
        body.customer_phone || null,
        dateOrNull(body.sign_date) || dateOrNull(new Date().toISOString()),
        dateOrNull(body.start_date),
        dateOrNull(body.end_date),
        body.payment_terms || null,
        num(body.discount),
        num(body.tax),
        body.tax_type || "0",
        num(body.subtotal),
        num(body.total_amount),
        body.notes || null,
        body.status || "draft",
        JSON.stringify(Array.isArray(body.items) ? body.items : []),
        body.contract_pdf_url || null,
      ],
    );
    return { success: true, data: result.rows[0] };
  } catch (e) { return fail((e as Error).message); }
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
    return { success: true, data: result.rows[0] };
  } catch (e) { return fail((e as Error).message); }
}

export async function deleteContract(id: string): Promise<{ success: true } | Fail> {
  try {
    await ensureContractSchema();
    const result = await query(`DELETE FROM odg_contract WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows.length) return fail("Contract not found");
    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}
