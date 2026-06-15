/** Live craftsman location (latest position per craftsman, tied to a work order). */
import { query } from "@/_lib/db";

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS odg_craftsman_location (
          employee_code TEXT PRIMARY KEY,
          work_order_id TEXT,
          work_no       TEXT,
          lat           NUMERIC(10,6),
          lng           NUMERIC(10,6),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    })().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}

export async function saveLocation(employeeCode: string, lat: unknown, lng: unknown, workOrderId?: string, workNo?: string): Promise<void> {
  await ensureTable();
  if (!employeeCode) return;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
  await query(
    `INSERT INTO odg_craftsman_location (employee_code, work_order_id, work_no, lat, lng, updated_at)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (employee_code) DO UPDATE
       SET work_order_id = EXCLUDED.work_order_id, work_no = EXCLUDED.work_no,
           lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = now()`,
    [String(employeeCode), workOrderId || null, workNo || null, la, ln],
  );
}

/** Latest known location of every craftsman, with their resolved name. */
export async function listLatestLocations(): Promise<any[]> {
  await ensureTable();
  const r = await query(`
    SELECT l.employee_code, l.work_order_id, l.work_no, l.lat, l.lng, l.updated_at,
           COALESCE(t.name_1, e.fullname_lo, l.employee_code) AS name
      FROM odg_craftsman_location l
      LEFT JOIN odg_technicians t ON t.code = l.employee_code
      LEFT JOIN odg_employee e ON e.employee_code = l.employee_code
     ORDER BY l.updated_at DESC`);
  return r.rows;
}
