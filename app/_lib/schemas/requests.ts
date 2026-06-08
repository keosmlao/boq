import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/**
 * Material request (ໃບຂໍເບີກ) schema. Lazily created on first request.
 *
 * Structure:
 *   - `odg_requests`        — header: 1 row per request document
 *   - `odg_requests_detail` — line items (cascade-deleted with header)
 *
 * `doc_ref` references a BOQ doc_no (optional — a request may come straight
 * from a BOQ or be manually created).
 *
 * `withdraw_doc_no` points at the matching row in `odg_withdraw_info` once the
 * request has been fulfilled by the ERP (set by the warehouse user; flips
 * `doc_success` to 1).
 */
export function ensureRequestsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_requests (
          doc_no            VARCHAR(50) PRIMARY KEY,
          doc_date          DATE NOT NULL DEFAULT CURRENT_DATE,
          doc_ref           VARCHAR(50),
          project_id        INTEGER,
          contract_no       VARCHAR(100),
          cust_code         VARCHAR(50),
          wh_from           VARCHAR(50),
          location_from     VARCHAR(50),
          creator_code      VARCHAR(50),
          requester_name    VARCHAR(200),
          remark            TEXT,
          doc_success       SMALLINT DEFAULT 0,
          withdraw_doc_no   VARCHAR(50),
          withdraw_date     DATE,
          created_at        TIMESTAMPTZ DEFAULT now(),
          updated_at        TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS odg_requests_project_idx  ON odg_requests(project_id);
        CREATE INDEX IF NOT EXISTS odg_requests_doc_ref_idx  ON odg_requests(doc_ref);
        CREATE INDEX IF NOT EXISTS odg_requests_status_idx   ON odg_requests(doc_success);
        CREATE INDEX IF NOT EXISTS odg_requests_doc_date_idx ON odg_requests(doc_date DESC);

        CREATE TABLE IF NOT EXISTS odg_requests_detail (
          id          BIGSERIAL PRIMARY KEY,
          doc_no      VARCHAR(50) NOT NULL REFERENCES odg_requests(doc_no) ON DELETE CASCADE,
          line_no     SMALLINT NOT NULL DEFAULT 1,
          item_code   VARCHAR(100),
          item_name   VARCHAR(500),
          unit_code   VARCHAR(50),
          qty         NUMERIC(18, 4) DEFAULT 0,
          remark      TEXT
        );
        CREATE INDEX IF NOT EXISTS odg_requests_detail_doc_no_idx    ON odg_requests_detail(doc_no);
        CREATE INDEX IF NOT EXISTS odg_requests_detail_item_code_idx ON odg_requests_detail(item_code);
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

/**
 * Auto-generate a request number — REQ-YYMMDD-NNNN.
 * Sequence resets per day; pads to 4 digits.
 */
export async function generateRequestDocNo(): Promise<string> {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const prefix = `REQ-${yy}${mm}${dd}-`;
  const result = await query(
    `SELECT doc_no FROM odg_requests WHERE doc_no LIKE $1 ORDER BY doc_no DESC LIMIT 1`,
    [`${prefix}%`],
  );
  let next = 1;
  if (result.rows.length) {
    const last = String(result.rows[0].doc_no);
    const tail = last.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
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

export function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}
