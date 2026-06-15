import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/**
 * v2 application users (RBAC). Lives in `public` (not the pending `pm` schema)
 * and is created lazily — same pattern as odg_request — so it works against the
 * live DB without a separate migration deploy. Login authenticates against this
 * table first, then falls back to the ERP-provisioned odg_project_manager_user.
 */
export function ensureUsersSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_app_user (
          username      TEXT PRIMARY KEY,
          name          TEXT,
          password_hash TEXT,
          role          TEXT NOT NULL DEFAULT 'staff',
          active        BOOLEAN NOT NULL DEFAULT true,
          permissions   JSONB NOT NULL DEFAULT '{}',
          created_by    TEXT,
          created_at    TIMESTAMPTZ DEFAULT now(),
          updated_at    TIMESTAMPTZ DEFAULT now()
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
