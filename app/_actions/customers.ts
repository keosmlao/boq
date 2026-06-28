"use server";

import { query, withTransaction } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";

type Fail = { success: false; message: string };
function fail(message: string): Fail {
  return { success: false, message };
}

const mapRow = (r: any) => ({
  code: r.code,
  name: r.name_1 || r.code,
  phone: r.telephone || "",
  address: r.address || "",
  province: r.province || "",
  district: r.amper || "",
  village: r.tambon || "",
  customer_type: "ລູກຄ້າໂຄງການ",
  ar_project_code: r.ar_project_code || "",
});

/** Project customers from ar_customer (those flagged with ar_project_code in ar_customer_detail). */
export async function getCustomers(opts: { search?: string } = {}): Promise<{ success: true; data: unknown[] } | Fail> {
  try {
    const s = (opts.search || "").trim();
    const params: unknown[] = [];
    let extra = "";
    if (s) {
      params.push(`%${s}%`);
      extra = ` AND (c.code ILIKE $1 OR c.name_1 ILIKE $1)`;
    }
    // Project customers = ar_type '03' ("Project" in the ar_type master).
    const sql = `
      SELECT c.code, c.name_1, c.telephone, c.address, c.province, c.amper, c.tambon
      FROM ar_customer c
      WHERE c.ar_type = '03'${extra}
      ORDER BY c.name_1 ASC
      LIMIT 300`;
    const r = await query(sql, params);
    return { success: true, data: r.rows.map(mapRow) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getCustomer(code: string): Promise<{ success: true; data: any } | Fail> {
  try {
    const r = await query(
      `SELECT c.code, c.name_1, c.telephone, c.address, c.province, c.amper, c.tambon
       FROM ar_customer c
       WHERE c.code = $1 LIMIT 1`,
      [code],
    );
    if (!r.rows.length) return fail("Customer not found");
    return { success: true, data: mapRow(r.rows[0]) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Next project-customer code in the SML/ERP running-number scheme ("NN-xxxx",
 * e.g. "01-3385"). Takes the highest existing suffix among matching ar_customer
 * codes and increments it, keeping the same prefix + zero-padding width.
 */
async function nextSmlCustomerCode(client: any): Promise<string> {
  const r = await client.query(
    `SELECT code FROM ar_customer
      WHERE code ~ '^[0-9]{1,3}-[0-9]+$'
      ORDER BY (split_part(code, '-', 2))::bigint DESC
      LIMIT 1`,
  );
  const top: string | undefined = r.rows[0]?.code;
  if (top && top.includes("-")) {
    const dash = top.indexOf("-");
    const prefix = top.slice(0, dash);
    const numStr = top.slice(dash + 1);
    const next = (parseInt(numStr, 10) || 0) + 1;
    return `${prefix}-${String(next).padStart(numStr.length, "0")}`;
  }
  return "01-0001";
}

/** Create a project customer directly in ar_customer (+ ar_customer_detail). */
export async function createCustomer(body: {
  name?: string;
  customerType?: string;
  province?: string;
  district?: string;
  village?: string;
  address?: string;
  phone?: string;
  code?: string;
}): Promise<{ success: true; data: any } | Fail> {
  try {
    await requirePermission("customers", "create");
    const name = (body?.name || "").trim();
    if (!name) return fail("ກະລຸນາໃສ່ຊື່ລູກຄ້າ");
    // Code follows the SML/ERP running-number scheme ("NN-xxxx"). An explicit
    // code (if provided) wins; otherwise we generate the next one in-transaction.
    let code = (body?.code || "").trim();
    // Dup-check + code generation + both inserts share one transaction so a
    // failure can't leave an orphan ar_customer with no detail row, and the
    // MAX reads happen inside the same atomic unit.
    await withTransaction(async (client) => {
      if (!code) code = await nextSmlCustomerCode(client);
      const dup = await client.query(`SELECT code FROM ar_customer WHERE code = $1 LIMIT 1`, [code]);
      if (dup.rows.length) throw new Error("ລະຫັດນີ້ມີໃນລະບົບແລ້ວ");

      // ar_type '03' = project customer. ignore_sync = 1 so the new row isn't pushed to the ERP sync.
      await client.query(
        `INSERT INTO ar_customer
          (roworder, code, name_1, address, province, amper, tambon, telephone, ar_type, status, ignore_sync, create_date_time_now)
         VALUES ((SELECT COALESCE(MAX(roworder),0)+1 FROM ar_customer), $1, $2, $3, $4, $5, $6, $7, '03', 0, 1, now())`,
        [code, name, body?.address || "", body?.province || "", body?.district || "", body?.village || "", body?.phone || ""],
      );
      await client.query(
        `INSERT INTO ar_customer_detail (roworder, ar_code, create_date_time_now)
         VALUES ((SELECT COALESCE(MAX(roworder),0)+1 FROM ar_customer_detail), $1, now())`,
        [code],
      );
    });

    return { success: true, data: { code, name, phone: body?.phone || "" } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function updateCustomer(
  code: string,
  body: { name?: string; province?: string; district?: string; village?: string; address?: string; phone?: string },
): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("customers", "edit");
    const name = (body?.name || "").trim();
    if (!name) return fail("ກະລຸນາໃສ່ຊື່ລູກຄ້າ");
    const r = await query(
      `UPDATE ar_customer SET name_1 = $2, address = $3, province = $4, amper = $5, tambon = $6, telephone = $7
       WHERE code = $1 RETURNING code`,
      [code, name, body?.address || "", body?.province || "", body?.district || "", body?.village || "", body?.phone || ""],
    );
    if (!r.rows.length) return fail("Customer not found");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Delete a project customer (ar_type '03') from ar_customer + ar_customer_detail. */
export async function deleteCustomer(code: string): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("customers", "delete");
    let deleted = 0;
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM ar_customer_detail WHERE ar_code = $1`, [code]);
      const r = await client.query(`DELETE FROM ar_customer WHERE code = $1 AND ar_type = '03' RETURNING code`, [code]);
      deleted = r.rows.length;
    });
    if (!deleted) return fail("ລົບບໍ່ໄດ້ (ບໍ່ແມ່ນລູກຄ້າໂຄງການ ຫຼື ບໍ່ພົບ)");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}
