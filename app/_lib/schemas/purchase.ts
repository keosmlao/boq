import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/**
 * ຂໍຊື້ (purchase request) — what the company has ORDERED from suppliers to
 * cover a BOQ shortfall. One row per item line, because the only question the
 * shortfall calculation asks is "how much of this item is already on order",
 * and a flat line table answers it with a single GROUP BY.
 *
 * The demand side is not stored: it is derived live from BOQ − withdrawn − stock
 * (see getPurchaseDemand), so it can never drift out of date.
 */
export function ensurePurchaseSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_purchase_request (
          id          BIGSERIAL PRIMARY KEY,
          pr_no       TEXT,
          item_code   TEXT NOT NULL,
          item_name   TEXT,
          unit        TEXT,
          qty         NUMERIC(18,4) DEFAULT 0,
          -- ordered  = ສັ່ງຊື້ແລ້ວ, ລໍສິນຄ້າ (still counts against the shortfall)
          -- received = ຮັບເຂົ້າສາງແລ້ວ (stock now reflects it — stops counting)
          -- cancelled= ຍົກເລີກ
          status      TEXT DEFAULT 'ordered',
          supplier    TEXT,
          note        TEXT,
          requester   TEXT,
          ordered_at  DATE DEFAULT CURRENT_DATE,
          created_at  TIMESTAMPTZ DEFAULT now(),
          updated_at  TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS odg_purchase_request_item_idx   ON odg_purchase_request(item_code);
        CREATE INDEX IF NOT EXISTS odg_purchase_request_status_idx ON odg_purchase_request(status);
        CREATE INDEX IF NOT EXISTS odg_purchase_request_no_idx     ON odg_purchase_request(pr_no);
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
