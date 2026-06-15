import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/** v2 material request (ຂໍເບີກ): request/withdraw BOQ materials for a project. */
export function ensureRequestSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_request (
          id          BIGSERIAL PRIMARY KEY,
          request_no  TEXT,
          project_id  TEXT,
          project_name TEXT,
          status      TEXT DEFAULT 'requested',
          items       JSONB DEFAULT '[]',
          notes       TEXT,
          requester   TEXT,
          created_at  TIMESTAMPTZ DEFAULT now(),
          updated_at  TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS odg_request_project_idx ON odg_request(project_id);
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
