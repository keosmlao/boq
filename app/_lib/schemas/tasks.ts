import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/** v2 task plan: the planned installation tasks for a project (assigned to technicians). */
export function ensureProjectTaskSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_project_task (
          id              BIGSERIAL PRIMARY KEY,
          project_id      TEXT,
          contract_id     TEXT,
          task_code       TEXT,
          title           TEXT NOT NULL,
          phase           TEXT,
          technician_code TEXT,
          technician_name TEXT,
          planned_start   DATE,
          planned_end     DATE,
          est_days        NUMERIC DEFAULT 0,
          est_hours       NUMERIC DEFAULT 0,
          actual_hours    NUMERIC DEFAULT 0,
          work_order_id   TEXT,
          status          TEXT DEFAULT 'planned',
          sort_order      INT DEFAULT 0,
          created_at      TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE odg_project_task ADD COLUMN IF NOT EXISTS est_days NUMERIC DEFAULT 0;
        ALTER TABLE odg_project_task ADD COLUMN IF NOT EXISTS actual_hours NUMERIC DEFAULT 0;
        ALTER TABLE odg_project_task ADD COLUMN IF NOT EXISTS work_order_id TEXT;
        CREATE INDEX IF NOT EXISTS odg_project_task_project_idx ON odg_project_task(project_id);
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
