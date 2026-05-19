"use server";

import { query } from "@/_lib/db";
import { dateOrNull, ensureQuotationSchema, num } from "@/_lib/schemas/quotations";

type Fail = { success: false; message: string };
function fail(message: string): Fail { return { success: false, message }; }

export async function getQuotations(opts: { projectId?: string; status?: string; search?: string } = {}): Promise<{ success: true; data: unknown[] } | Fail> {
  try {
    await ensureQuotationSchema();
    const conds: string[] = [];
    const params: unknown[] = [];
    if (opts.projectId) { params.push(opts.projectId); conds.push(`project_id = $${params.length}`); }
    if (opts.status && opts.status !== "all") { params.push(opts.status); conds.push(`status = $${params.length}`); }
    if (opts.search) {
      params.push(`%${opts.search}%`);
      conds.push(`(quotation_no ILIKE $${params.length} OR project_name ILIKE $${params.length} OR customer_name ILIKE $${params.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const result = await query(`SELECT * FROM odg_quotation ${where} ORDER BY created_at DESC LIMIT 500`, params);
    return { success: true, data: result.rows };
  } catch (e) { return fail((e as Error).message); }
}

export async function createQuotation(body: any): Promise<{ success: true; data: unknown } | Fail> {
  try {
    await ensureQuotationSchema();
    if (!body?.quotation_no) return fail("quotation_no is required");

    const result = await query(
      `INSERT INTO odg_quotation (
        quotation_no, project_id, project_name,
        customer_name, customer_address, customer_phone,
        quotation_date, validity_date, terms,
        discount, tax, tax_type, subtotal, total_amount,
        notes, status, items
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        String(body.quotation_no),
        body.project_id ? String(body.project_id) : null,
        body.project_name || null,
        body.customer_name || null,
        body.customer_address || null,
        body.customer_phone || null,
        dateOrNull(body.quotation_date),
        dateOrNull(body.validity_date),
        body.terms || null,
        num(body.discount),
        num(body.tax),
        body.tax_type || "0",
        num(body.subtotal),
        num(body.total_amount),
        body.notes || null,
        body.status || "ລໍຖ້າອະນຸມັດ",
        JSON.stringify(Array.isArray(body.items) ? body.items : []),
      ],
    );
    return { success: true, data: result.rows[0] };
  } catch (e) { return fail((e as Error).message); }
}

export async function getQuotation(id: string): Promise<Record<string, unknown> | Fail> {
  try {
    await ensureQuotationSchema();
    const result = await query(`SELECT * FROM odg_quotation WHERE id = $1 LIMIT 1`, [id]);
    if (!result.rows.length) return fail("Quotation not found");
    return result.rows[0];
  } catch (e) { return fail((e as Error).message); }
}

export async function updateQuotation(id: string, body: any): Promise<{ success: true; data: unknown } | Fail> {
  try {
    await ensureQuotationSchema();
    const result = await query(
      `UPDATE odg_quotation SET
        quotation_no = COALESCE($2, quotation_no),
        project_id = $3, project_name = $4, customer_name = $5,
        customer_address = $6, customer_phone = $7,
        quotation_date = $8, validity_date = $9, terms = $10,
        discount = $11, tax = $12, tax_type = $13, subtotal = $14, total_amount = $15,
        notes = $16, status = COALESCE($17, status), items = $18, updated_at = now()
      WHERE id = $1 RETURNING *`,
      [
        id,
        body.quotation_no || null,
        body.project_id ? String(body.project_id) : null,
        body.project_name || null,
        body.customer_name || null,
        body.customer_address || null,
        body.customer_phone || null,
        dateOrNull(body.quotation_date),
        dateOrNull(body.validity_date),
        body.terms || null,
        num(body.discount),
        num(body.tax),
        body.tax_type || "0",
        num(body.subtotal),
        num(body.total_amount),
        body.notes || null,
        body.status || null,
        JSON.stringify(Array.isArray(body.items) ? body.items : []),
      ],
    );
    if (!result.rows.length) return fail("Quotation not found");
    return { success: true, data: result.rows[0] };
  } catch (e) { return fail((e as Error).message); }
}

export async function deleteQuotation(id: string): Promise<{ success: true } | Fail> {
  try {
    await ensureQuotationSchema();
    const result = await query(`DELETE FROM odg_quotation WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows.length) return fail("Quotation not found");
    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}
