import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/**
 * Which vehicles from the company register are ລົດຊ່າງ.
 *
 * `app_car_vehicles` holds every vehicle the group owns — sales cars, trackers,
 * everything — and belongs to the car system. This app cannot add a column
 * there, so it keeps its own short list of the ones the installation teams use.
 * One row per vehicle id; absence simply means "not a craftsman vehicle".
 */
export function ensureTechVehicleSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_tech_vehicle (
          vehicle_id  TEXT PRIMARY KEY,
          note        TEXT,
          marked_by   TEXT,
          created_at  TIMESTAMPTZ DEFAULT now()
        );
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
