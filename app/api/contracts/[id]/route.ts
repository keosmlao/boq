export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, fail, serverError } from "@/_lib/http";
import { query } from "@/_lib/db";
import { dateOrNull, ensureContractSchema, num } from "../_schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureContractSchema();
    const { id } = await params;
    const result = await query(`SELECT * FROM odg_contract WHERE id = $1 LIMIT 1`, [id]);
    if (!result.rows.length) return fail("Contract not found", 404);
    return ok(result.rows[0]);
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    await ensureContractSchema();
    const { id } = await params;
    const body = await req.json();

    const result = await query(
      `
      UPDATE odg_contract SET
        contract_no      = COALESCE($2, contract_no),
        project_id       = $3,
        project_name     = $4,
        customer_name    = $5,
        customer_address = $6,
        customer_phone   = $7,
        sign_date        = $8,
        start_date       = $9,
        end_date         = $10,
        payment_terms    = $11,
        discount         = $12,
        tax              = $13,
        tax_type         = $14,
        subtotal         = $15,
        total_amount     = $16,
        notes            = $17,
        status           = COALESCE($18, status),
        items            = $19,
        contract_pdf_url = $20,
        updated_at       = now()
      WHERE id = $1
      RETURNING *
      `,
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

    if (!result.rows.length) return fail("Contract not found", 404);
    return ok({ success: true, data: result.rows[0] });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureContractSchema();
    const { id } = await params;
    const result = await query(`DELETE FROM odg_contract WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows.length) return fail("Contract not found", 404);
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
