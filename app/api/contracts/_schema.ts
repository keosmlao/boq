import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/**
 * Lazily creates the odg_contract table on first request. One contract maps
 * 1:1 to an approved quotation; one project has many contracts (one per
 * approved quotation).
 *
 * Items are denormalised from the quotation as JSONB so the contract is
 * self-contained even if the source quotation is later edited.
 */
export function ensureContractSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_contract (
          id                BIGSERIAL PRIMARY KEY,
          contract_no       TEXT NOT NULL UNIQUE,
          quotation_id      BIGINT REFERENCES odg_quotation(id) ON DELETE SET NULL,
          project_id        TEXT,
          project_name      TEXT,
          customer_name     TEXT,
          customer_address  TEXT,
          customer_phone    TEXT,
          sign_date         DATE,
          start_date        DATE,
          end_date          DATE,
          payment_terms     TEXT,
          discount          NUMERIC(18, 2) DEFAULT 0,
          tax               NUMERIC(18, 2) DEFAULT 0,
          tax_type          TEXT DEFAULT '0',
          subtotal          NUMERIC(18, 2) DEFAULT 0,
          total_amount      NUMERIC(18, 2) DEFAULT 0,
          notes             TEXT,
          status            TEXT DEFAULT 'draft',
          items             JSONB DEFAULT '[]'::jsonb,
          contract_pdf_url  TEXT,
          created_at        TIMESTAMPTZ DEFAULT now(),
          updated_at        TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS odg_contract_project_idx   ON odg_contract(project_id);
        CREATE INDEX IF NOT EXISTS odg_contract_quotation_idx ON odg_contract(quotation_id);
        CREATE INDEX IF NOT EXISTS odg_contract_status_idx    ON odg_contract(status);
        CREATE INDEX IF NOT EXISTS odg_contract_created_idx   ON odg_contract(created_at DESC);
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

export function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function dateOrNull(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Auto-generate a contract number — CT-YYMMDD-XXXX.
 * Callers can override by supplying their own contract_no.
 */
export function generateContractNo(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `CT-${yy}${mm}${dd}-${rnd}`;
}
