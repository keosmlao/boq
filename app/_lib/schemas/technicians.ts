import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/**
 * odg_technicians lives in the shared ERP DB — we only add the app-owned columns.
 * ລົດຊ່າງ: each team keeps a default vehicle (from public.app_car_vehicles), which
 * a work order picks up as its default.
 */
export function ensureTechnicianSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        ALTER TABLE odg_technicians ADD COLUMN IF NOT EXISTS vehicle_id TEXT;
        ALTER TABLE odg_technicians ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;
        ALTER TABLE odg_technicians ADD COLUMN IF NOT EXISTS vehicle_name TEXT;
      `);
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}
