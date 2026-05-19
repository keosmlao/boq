export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, fail, serverError } from "@/_lib/http";
import { query } from "@/_lib/db";
import { dateOrNull, ensureContractSchema, generateContractNo, num } from "./_schema";

/**
 * GET /api/contracts?project_id=...&status=...&quotation_id=...&search=...
 */
export async function GET(req: NextRequest) {
  try {
    await ensureContractSchema();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    const quotationId = url.searchParams.get("quotation_id");
    const status = url.searchParams.get("status");
    const search = (url.searchParams.get("search") || "").trim();

    const conds: string[] = [];
    const params: unknown[] = [];
    if (projectId) {
      params.push(projectId);
      conds.push(`project_id = $${params.length}`);
    }
    if (quotationId) {
      params.push(quotationId);
      conds.push(`quotation_id = $${params.length}`);
    }
    if (status && status !== "all") {
      params.push(status);
      conds.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conds.push(
        `(contract_no ILIKE $${params.length} OR project_name ILIKE $${params.length} OR customer_name ILIKE $${params.length})`,
      );
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const result = await query(
      `SELECT * FROM odg_contract ${where} ORDER BY created_at DESC LIMIT 500`,
      params,
    );
    return ok({ success: true, data: result.rows });
  } catch (error) {
    return serverError(error);
  }
}

/**
 * POST /api/contracts        — manual create
 * POST /api/contracts?from_quotation=ID  — clone from approved quotation
 */
export async function POST(req: NextRequest) {
  try {
    await ensureContractSchema();
    const url = new URL(req.url);
    const fromQuotation = url.searchParams.get("from_quotation");

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    // Clone-from-quotation path
    if (fromQuotation) {
      const q = await query(`SELECT * FROM odg_quotation WHERE id = $1`, [fromQuotation]);
      if (!q.rows.length) return fail("Quotation not found", 404);
      const src = q.rows[0];
      if (src.status !== "ອະນຸມັດແລ້ວ") {
        return fail("Only approved quotations can be converted to contracts", 400);
      }
      // Reject if a contract already exists for this quotation
      const existing = await query(
        `SELECT id FROM odg_contract WHERE quotation_id = $1 LIMIT 1`,
        [fromQuotation],
      );
      if (existing.rows.length) {
        return fail("Contract already exists for this quotation", 409, {
          contract_id: existing.rows[0].id,
        });
      }
      body = {
        ...src,
        // strip quotation-only fields and let DB defaults fill the rest
        ...body,
        quotation_id: src.id,
        contract_no: body.contract_no || generateContractNo(),
        status: "draft",
      };
    }

    if (!body.contract_no) body.contract_no = generateContractNo();

    const result = await query(
      `
      INSERT INTO odg_contract (
        contract_no, quotation_id, project_id, project_name,
        customer_name, customer_address, customer_phone,
        sign_date, start_date, end_date, payment_terms,
        discount, tax, tax_type, subtotal, total_amount,
        notes, status, items, contract_pdf_url
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20
      )
      RETURNING *
      `,
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

    return ok({ success: true, data: result.rows[0] });
  } catch (error) {
    return serverError(error);
  }
}
