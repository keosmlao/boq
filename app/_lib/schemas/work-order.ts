import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/** v2 work order (ໃບງານ): execution of the task plan — team, dates, actual hours → labour cost. */
export function ensureWorkOrderSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_work_order (
          id            BIGSERIAL PRIMARY KEY,
          work_no         TEXT,
          project_id      TEXT,
          contract_id     TEXT,
          work_date       DATE,
          end_date        DATE,
          technician_code TEXT,
          technician_name TEXT,
          rate_per_hour   NUMERIC DEFAULT 0,
          total_hours     NUMERIC DEFAULT 0,
          labor_cost      NUMERIC DEFAULT 0,
          status          TEXT DEFAULT 'open',
          notes           TEXT,
          tasks           JSONB DEFAULT '[]',
          materials       JSONB DEFAULT '[]',
          created_at      TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS end_date DATE;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS technician_code TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS technician_name TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]';
        CREATE INDEX IF NOT EXISTS odg_work_order_project_idx ON odg_work_order(project_id);
        `,
        [],
      );
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}
