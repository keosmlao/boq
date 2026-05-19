export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, serverError } from "@/_lib/http";
import { query } from "@/_lib/db";

/**
 * GET /api/inventory?search=...&limit=30
 * GET /api/inventory?debug=columns   → returns the actual column list for ic_inventory
 *
 * Returns products from `ic_inventory` for the quotation/BOQ product picker.
 * Matches on `code` (exact prefix priority) and `name_1` (Lao name, ILIKE).
 *
 * SELECT * so the route survives schema variations between deployments.
 * The frontend picks the fields it needs (code, name_1, unit_cost, etc.).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Debug helper — call /api/inventory?debug=columns to discover schema.
    if (url.searchParams.get("debug") === "columns") {
      const cols = await query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_name = 'ic_inventory'
         ORDER BY ordinal_position`,
        [],
      );
      return ok({ success: true, columns: cols.rows });
    }

    // Debug — list any tables/columns whose name contains "unit" so we can
    // find where the unit-of-measure lives for products.
    if (url.searchParams.get("debug") === "unit-tables") {
      const tables = await query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND (table_name ILIKE '%unit%' OR table_name ILIKE '%uom%' OR table_name ILIKE '%inventory%')
         ORDER BY table_name`,
        [],
      );
      const cols = await query(
        `SELECT table_name, column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND (column_name ILIKE '%unit%' OR column_name ILIKE '%uom%')
         ORDER BY table_name, ordinal_position`,
        [],
      );
      return ok({ success: true, tables: tables.rows, columns_with_unit: cols.rows });
    }

    const search = (url.searchParams.get("search") || "").trim();
    const limitParam = parseInt(url.searchParams.get("limit") || "30", 10);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 30, 1), 200);

    const params: unknown[] = [];
    let where = "WHERE 1=1";
    let prefixIndex = 0;

    if (search) {
      params.push(`%${search}%`);
      params.push(`${search}%`);
      where += ` AND (code ILIKE $1 OR name_1 ILIKE $1)`;
      prefixIndex = 2;
    }

    const sql = `
      SELECT *
      FROM ic_inventory
      ${where}
      ORDER BY
        ${prefixIndex ? `CASE WHEN code ILIKE $${prefixIndex} THEN 0 ELSE 1 END, ` : ""}
        code ASC
      LIMIT ${limit}
    `;

    const result = await query(sql, params);

    // Normalize each row so the frontend has predictable field names.
    // Fallback chain covers common ERP schemas (Prosoft myAccount, generic).
    const pickFirst = (r: Record<string, unknown>, ...keys: string[]) => {
      for (const k of keys) {
        const v = r[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return null;
    };

    const data = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      code: pickFirst(r, "code", "item_code"),
      name_1: pickFirst(r, "name_1", "item_name", "name"),
      // This deployment stores the unit-of-measure value in `unit_cost`
      // (per project owner). Map it to `unit` so the order-line form picks
      // it up. `sale_price` below still references unit_cost for the price.
      unit: pickFirst(r, "unit_cost"),
      unit_cost: pickFirst(r, "unit_cost", "average_cost", "cost", "price"),
      sale_price: pickFirst(r, "sale_price", "sale_price_1", "price_1", "price", "unit_cost"),
    }));

    return ok({ success: true, data });
  } catch (error) {
    return serverError(error);
  }
}
