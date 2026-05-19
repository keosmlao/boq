import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/**
 * Lazily creates the odg_quotation table on first request. Safe to call from
 * every route handler — subsequent calls return the same cached promise.
 *
 * Items are stored as JSONB to keep the migration footprint small. If row-
 * level reporting is needed later, split into `odg_quotation_item`.
 */
export function ensureQuotationSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_quotation (
          id                BIGSERIAL PRIMARY KEY,
          quotation_no      TEXT NOT NULL UNIQUE,
          project_id        TEXT,
          project_name      TEXT,
          customer_name     TEXT,
          customer_address  TEXT,
          customer_phone    TEXT,
          quotation_date    DATE,
          validity_date     DATE,
          terms             TEXT,
          discount          NUMERIC(18, 2) DEFAULT 0,
          tax               NUMERIC(18, 2) DEFAULT 0,
          tax_type          TEXT DEFAULT '0',
          subtotal          NUMERIC(18, 2) DEFAULT 0,
          total_amount      NUMERIC(18, 2) DEFAULT 0,
          notes             TEXT,
          status            TEXT DEFAULT 'ລໍຖ້າອະນຸມັດ',
          items             JSONB DEFAULT '[]'::jsonb,
          created_at        TIMESTAMPTZ DEFAULT now(),
          updated_at        TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS odg_quotation_project_id_idx ON odg_quotation(project_id);
        CREATE INDEX IF NOT EXISTS odg_quotation_status_idx     ON odg_quotation(status);
        CREATE INDEX IF NOT EXISTS odg_quotation_created_idx    ON odg_quotation(created_at DESC);
        `,
        [],
      );
    })().catch((err) => {
      // Reset cache so we retry next request — don't lock the route forever.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/** Normalize a numeric form field (string|number|null) into a finite number. */
export function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize a date form field into a YYYY-MM-DD string or null. */
export function dateOrNull(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
