/** Craftsman online presence — the app pings every ~30s; "online" = seen recently. */
import { query } from "@/_lib/db";

const ONLINE_SECONDS = 90; // seen within this window → online

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS odg_craftsman_presence (
          employee_code TEXT PRIMARY KEY,
          last_seen     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    })().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}

export async function savePresence(employeeCode: string): Promise<void> {
  await ensureTable();
  if (!employeeCode) return;
  await query(
    `INSERT INTO odg_craftsman_presence (employee_code, last_seen) VALUES ($1, now())
     ON CONFLICT (employee_code) DO UPDATE SET last_seen = now()`,
    [String(employeeCode)],
  );
}

/** Everyone seen in the last 24h, with an `online` flag + resolved name. */
export async function listPresence(): Promise<any[]> {
  await ensureTable();
  const r = await query(`
    SELECT p.employee_code,
           p.last_seen,
           (now() - p.last_seen) < interval '${ONLINE_SECONDS} seconds' AS online,
           COALESCE(t.name_1, e.fullname_lo, p.employee_code) AS name
      FROM odg_craftsman_presence p
      LEFT JOIN odg_technicians t ON t.code = p.employee_code
      LEFT JOIN odg_employee e ON e.employee_code = p.employee_code
     WHERE p.last_seen > now() - interval '24 hours'
     ORDER BY online DESC, p.last_seen DESC`);
  return r.rows;
}
