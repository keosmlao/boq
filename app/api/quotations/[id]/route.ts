export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, fail, serverError } from "@/_lib/http";
import { query } from "@/_lib/db";
import { dateOrNull, ensureQuotationSchema, num } from "../_schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureQuotationSchema();
    const { id } = await params;
    const result = await query(`SELECT * FROM odg_quotation WHERE id = $1 LIMIT 1`, [id]);
    if (!result.rows.length) return fail("Quotation not found", 404);
    return ok(result.rows[0]);
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    await ensureQuotationSchema();
    const { id } = await params;
    const body = await req.json();

    const result = await query(
      `
      UPDATE odg_quotation SET
        quotation_no     = COALESCE($2, quotation_no),
        project_id       = $3,
        project_name     = $4,
        customer_name    = $5,
        customer_address = $6,
        customer_phone   = $7,
        quotation_date   = $8,
        validity_date    = $9,
        terms            = $10,
        discount         = $11,
        tax              = $12,
        tax_type         = $13,
        subtotal         = $14,
        total_amount     = $15,
        notes            = $16,
        status           = COALESCE($17, status),
        items            = $18,
        updated_at       = now()
      WHERE id = $1
      RETURNING *
      `,
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

    if (!result.rows.length) return fail("Quotation not found", 404);
    return ok({ success: true, data: result.rows[0] });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureQuotationSchema();
    const { id } = await params;
    const result = await query(`DELETE FROM odg_quotation WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows.length) return fail("Quotation not found", 404);
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
