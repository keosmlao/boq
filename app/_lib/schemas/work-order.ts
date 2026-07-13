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

        -- ── Mobile head-craftsman lifecycle: approve → accept/reject → check-in → check-out ──
        -- Manager approval gate
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'; -- pending | approved | rejected
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS approver TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS approve_note TEXT;
        -- Optional: login user of the assigned head craftsman. When set, only that
        -- user (or a manager) may accept/check-in/check-out. When null, any logged-in
        -- user holding the work order may act (no username↔technician map exists yet).
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS assigned_username TEXT;
        -- Links a v2 work order back to the legacy ERP one it was mirrored from.
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS legacy_code TEXT;
        -- Head-craftsman accept / reject of an approved work order
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS accept_status TEXT DEFAULT 'pending'; -- pending | accepted | rejected
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS accepted_by TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS reject_reason TEXT;
        -- On-site check-in (before starting): photo + GPS
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkin_at TIMESTAMPTZ;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkin_lat NUMERIC(10,6);
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkin_lng NUMERIC(10,6);
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkin_photo TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkin_photos JSONB DEFAULT '[]';
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkin_note TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkin_by TEXT;
        -- On completion check-out (work done → awaiting inspection): photo + GPS
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkout_at TIMESTAMPTZ;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkout_lat NUMERIC(10,6);
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkout_lng NUMERIC(10,6);
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkout_photo TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkout_photos JSONB DEFAULT '[]';
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkout_note TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkout_signature TEXT; -- customer sign-off image (url)
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS checkout_by TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS shift TEXT; -- 'morning' | 'afternoon'
        -- ລົດຊ່າງ: vehicle assigned to the team (from public.app_car_vehicles)
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS vehicle_id TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS vehicle_name TEXT;

        -- Material requests raised by the craftsman from the app (app-owned).
        CREATE TABLE IF NOT EXISTS odg_wo_material_request (
          id            BIGSERIAL PRIMARY KEY,
          work_order_id TEXT,
          project_id    TEXT,
          requested_by  TEXT,
          items         JSONB DEFAULT '[]',
          note          TEXT,
          status        TEXT DEFAULT 'pending',
          wh_code       TEXT,
          wh_name       TEXT,
          shelf_code    TEXT,
          shelf_name    TEXT,
          created_at    TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE odg_wo_material_request ADD COLUMN IF NOT EXISTS wh_code TEXT;
        ALTER TABLE odg_wo_material_request ADD COLUMN IF NOT EXISTS wh_name TEXT;
        ALTER TABLE odg_wo_material_request ADD COLUMN IF NOT EXISTS shelf_code TEXT;
        ALTER TABLE odg_wo_material_request ADD COLUMN IF NOT EXISTS shelf_name TEXT;
        -- ຜູ້ໃຊ້ວັດສະດຸ (ທີມ/ຊ່າງ) + status tracking (ຂໍເບີກ→ອະນຸມັດ→ເບີກແລ້ວ)
        ALTER TABLE odg_wo_material_request ADD COLUMN IF NOT EXISTS used_by_code TEXT;
        ALTER TABLE odg_wo_material_request ADD COLUMN IF NOT EXISTS used_by_name TEXT;
        ALTER TABLE odg_wo_material_request ADD COLUMN IF NOT EXISTS approver TEXT;
        ALTER TABLE odg_wo_material_request ADD COLUMN IF NOT EXISTS status_at TIMESTAMPTZ;
        ALTER TABLE odg_wo_material_request ADD COLUMN IF NOT EXISTS status_note TEXT;
        CREATE INDEX IF NOT EXISTS odg_wo_matreq_wo_idx ON odg_wo_material_request(work_order_id);
        -- Inspection close (after ລໍຖ້າກວດສອບ → ປິດງານແລ້ວ), by a manager/inspector
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS closed_by TEXT;
        ALTER TABLE odg_work_order ADD COLUMN IF NOT EXISTS close_note TEXT;
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
