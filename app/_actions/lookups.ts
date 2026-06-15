"use server";

import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";
import { cached } from "@/_lib/cache";
import {
  listBusinessModels,
  listBusinessTypes,
  listDistricts,
  listProjectTypes,
  listProvinces,
  listSaleStaffs,
  listVillages,
} from "@/_lib/projects";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; message: string };
type Result<T> = Ok<T> | Fail;

function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function fail(message: string): Fail { return { success: false, message }; }

// Reference data (geo, taxonomy, staff) rarely changes — cache it for 5 min so
// forms with cascading dropdowns don't re-hit the remote DB on every change.
const REF_TTL = 5 * 60 * 1000;

export async function getBusinessModels(businessType?: string): Promise<Result<unknown[]>> {
  try {
    const bt = cleanText(businessType);
    return ok(await cached(`lk:bizmodels:${bt}`, REF_TTL, () => listBusinessModels(bt)));
  } catch (e) { return fail((e as Error).message); }
}

export async function getBusinessTypes(): Promise<Result<unknown[]>> {
  try {
    return ok(await cached("lk:biztypes", REF_TTL, () => listBusinessTypes()));
  } catch (e) { return fail((e as Error).message); }
}

export async function getProjectTypes(opts: { businessType?: string; businessModel?: string } = {}): Promise<Result<unknown[]>> {
  try {
    const bt = cleanText(opts.businessType);
    const bm = cleanText(opts.businessModel);
    return ok(await cached(`lk:projtypes:${bt}:${bm}`, REF_TTL, () => listProjectTypes({ businessType: bt, businessModel: bm })));
  } catch (e) { return fail((e as Error).message); }
}

export async function getProvinces(): Promise<Result<unknown[]>> {
  try {
    return ok(await cached("lk:provinces", REF_TTL, () => listProvinces()));
  } catch (e) { return fail((e as Error).message); }
}

export async function getDistricts(province: string): Promise<Result<unknown[]>> {
  try {
    const p = cleanText(province);
    if (!p) return fail("province is required");
    return ok(await cached(`lk:districts:${p}`, REF_TTL, () => listDistricts(p)));
  } catch (e) { return fail((e as Error).message); }
}

export async function getVillages(province: string, district: string): Promise<Result<unknown[]>> {
  try {
    const p = cleanText(province);
    const d = cleanText(district);
    if (!p || !d) return fail("province and district are required");
    return ok(await cached(`lk:villages:${p}:${d}`, REF_TTL, () => listVillages({ province: p, district: d })));
  } catch (e) { return fail((e as Error).message); }
}

export async function getSaleStaffs(): Promise<Result<unknown[]>> {
  try {
    return ok(await cached("lk:salestaffs", REF_TTL, () => listSaleStaffs()));
  } catch (e) { return fail((e as Error).message); }
}

export async function getWarehouses(): Promise<Result<unknown[]>> {
  try {
    const result = await query(`
      SELECT
        code,
        code AS warehouse_code,
        name_1,
        name_1 AS warehouse_name,
        name_1 AS name,
        name_2,
        branch_code,
        wh_manager
      FROM ic_warehouse
      ORDER BY code ASC
    `);
    return ok(result.rows);
  } catch (e) { return fail((e as Error).message); }
}

export async function getLocations(warehouse: string): Promise<Result<unknown[]>> {
  try {
    const w = cleanText(warehouse);
    if (!w) return ok([]);
    const result = await query(`
      SELECT DISTINCT
        s.code,
        s.code AS location_code,
        s.name_1,
        s.name_1 AS location_name,
        s.name_1 AS name,
        s.name_2,
        s.whcode,
        s.remark
      FROM ic_shelf s
      WHERE (
        s.whcode = $1
        OR EXISTS (
          SELECT 1 FROM ic_wh_shelf w
          WHERE w.wh_code = $1 AND w.shelf_code = s.code
        )
      )
      ORDER BY s.code ASC
    `, [w]);
    return ok(result.rows);
  } catch (e) { return fail((e as Error).message); }
}

export async function getTasks(): Promise<Result<unknown[]>> {
  try {
    const result = await query(`
      SELECT
        id,
        code,
        phase,
        task,
        task AS name,
        owner,
        status
      FROM odg_task_master
      ORDER BY id ASC
    `);
    return ok(result.rows);
  } catch (e) { return fail((e as Error).message); }
}

export async function getTechnicians(): Promise<Result<unknown[]>> {
  try {
    const result = await query(`
      SELECT roworder, code, name_1, phone, role, helpers, created_at
      FROM odg_technicians
      ORDER BY role DESC, name_1 ASC, code ASC
    `);
    return ok(result.rows);
  } catch (e) { return fail((e as Error).message); }
}

export async function createTechnician(payload: Record<string, unknown>): Promise<{ success: true; roworder: number } | Fail> {
  try {
    const result = await query(`
      INSERT INTO odg_technicians (code, name_1, phone, role, helpers)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING roworder
    `, [
      cleanText(payload?.code),
      cleanText(payload?.name_1 || payload?.name),
      cleanText(payload?.phone),
      cleanText(payload?.role) || "technician",
      JSON.stringify(Array.isArray(payload?.helpers) ? payload.helpers : []),
    ]);
    return { success: true, roworder: result.rows[0]?.roworder };
  } catch (e) { return fail((e as Error).message); }
}

export async function updateTechnician(id: number | string, payload: Record<string, unknown>): Promise<{ success: true } | Fail> {
  try {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (payload?.code !== undefined) {
      values.push(cleanText(payload.code));
      updates.push(`code = $${values.length}`);
    }
    if (payload?.name_1 !== undefined || payload?.name !== undefined) {
      values.push(cleanText(payload.name_1 || payload.name));
      updates.push(`name_1 = $${values.length}`);
    }
    if (payload?.phone !== undefined) {
      values.push(cleanText(payload.phone));
      updates.push(`phone = $${values.length}`);
    }
    if (payload?.role !== undefined) {
      values.push(cleanText(payload.role));
      updates.push(`role = $${values.length}`);
    }
    if (payload?.helpers !== undefined) {
      values.push(JSON.stringify(Array.isArray(payload.helpers) ? payload.helpers : []));
      updates.push(`helpers = $${values.length}::jsonb`);
    }

    if (!updates.length) return { success: true };

    values.push(Number(id));
    await query(`
      UPDATE odg_technicians
      SET ${updates.join(", ")}
      WHERE roworder = $${values.length}
    `, values);
    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}

export async function deleteTechnician(id: number | string): Promise<{ success: true } | Fail> {
  try {
    await query(`DELETE FROM odg_technicians WHERE roworder = $1`, [Number(id)]);
    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}

export async function getHelpers(): Promise<{ success: true; data: { data: unknown[] } } | Fail> {
  try {
    const result = await query(`
      SELECT roworder, code, name_1, phone, role
      FROM odg_technicians
      WHERE lower(coalesce(role, '')) IN ('assistant', 'helper', 'technician', 'lead')
      ORDER BY role ASC, name_1 ASC, code ASC
    `);
    return { success: true, data: { data: result.rows } };
  } catch (e) { return fail((e as Error).message); }
}

export async function getInventory(opts: { search?: string; limit?: number } = {}): Promise<Result<unknown[]>> {
  try {
    const search = cleanText(opts.search);
    const limitParam = Number.isFinite(opts.limit) ? Number(opts.limit) : 30;
    const limit = Math.min(Math.max(limitParam, 1), 200);

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

    const pickFirst = (r: Record<string, unknown>, ...keys: string[]) => {
      for (const k of keys) {
        const v = r[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return null;
    };

    return ok(result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      code: pickFirst(r, "code", "item_code"),
      name_1: pickFirst(r, "name_1", "item_name", "name"),
      // In this ERP the unit is stored as text in `unit_standard`
      // (the column literally named `unit_cost` is also the unit string, NOT a cost).
      unit: pickFirst(r, "unit_standard", "unit_standard_name"),
      // Real numeric cost lives in average_cost.
      unit_cost: pickFirst(r, "average_cost", "average_cost_1", "fixed_cost"),
      // No sale price exists in ic_inventory — use cost as the starting price hint.
      sale_price: pickFirst(r, "average_cost", "average_cost_1", "fixed_cost"),
    })));
  } catch (e) { return fail((e as Error).message); }
}
