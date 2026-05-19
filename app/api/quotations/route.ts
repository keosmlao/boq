export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, fail, serverError } from "@/_lib/http";
import { query } from "@/_lib/db";
import { dateOrNull, ensureQuotationSchema, num } from "./_schema";

/**
 * GET /api/quotations?project_id=...&status=...&search=...
 * Lists quotations newest-first. Filters are optional.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureQuotationSchema();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    const status = url.searchParams.get("status");
    const search = (url.searchParams.get("search") || "").trim();

    const conds: string[] = [];
    const params: unknown[] = [];
    if (projectId) {
      params.push(projectId);
      conds.push(`project_id = $${params.length}`);
    }
    if (status && status !== "all") {
      params.push(status);
      conds.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conds.push(
        `(quotation_no ILIKE $${params.length} OR project_name ILIKE $${params.length} OR customer_name ILIKE $${params.length})`,
      );
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const result = await query(
      `SELECT * FROM odg_quotation ${where} ORDER BY created_at DESC LIMIT 500`,
      params,
    );
    return ok({ success: true, data: result.rows });
  } catch (error) {
    return serverError(error);
  }
}

/**
 * POST /api/quotations  body = full form payload
 */
export async function POST(req: NextRequest) {
  try {
    await ensureQuotationSchema();
    const body = await req.json();

    if (!body?.quotation_no) return fail("quotation_no is required", 400);

    const result = await query(
      `
      INSERT INTO odg_quotation (
        quotation_no, project_id, project_name,
        customer_name, customer_address, customer_phone,
        quotation_date, validity_date, terms,
        discount, tax, tax_type, subtotal, total_amount,
        notes, status, items
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17
      )
      RETURNING *
      `,
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

    return ok({ success: true, data: result.rows[0] });
  } catch (error) {
    return serverError(error);
  }
}
