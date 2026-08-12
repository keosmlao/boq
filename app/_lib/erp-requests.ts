import { query } from "@/_lib/db";

/**
 * How a material request (ໃບຂໍເບີກ) is mirrored into SML — ERP/SML convention,
 * shared by the legacy and v2 flows so the warehouse sees both the same way.
 */
export const IC_TRANS_REQUEST_TYPE = 3;
export const IC_TRANS_REQUEST_FLAG = 122;
/**
 * SML shows a blank branch unless branch_code is set; ic_warehouse.branch_code is
 * mostly null so it cannot be derived from the warehouse — the head office is "00".
 */
export const IC_TRANS_BRANCH_CODE = "00";

/** Rows that are a request's own mirror document, not a withdrawal of it. */
const notMirror = (alias: string) =>
  `NOT (${alias}.trans_type = ${IC_TRANS_REQUEST_TYPE} AND ${alias}.trans_flag = ${IC_TRANS_REQUEST_FLAG})`;
/** The document was not cancelled in SML. */
const live = (alias: string) => `COALESCE(${alias}.is_cancel, 0) = 0`;

export type ErpWithdrawn = {
  /** Every request number the ERP shows as issued, free-text matches included. */
  all: Set<string>;
  /**
   * Only the ones proven by a structured link (doc_success / doc_ref). These are
   * safe to write back into a status column; a free-text match is not, since
   * nothing in the UI can undo a wrong ເບີກແລ້ວ.
   */
  linked: Set<string>;
};

/** Run one detection probe; a missing table/column disables only that probe. */
async function probe(label: string, sql: string, params: unknown[]): Promise<string[]> {
  try {
    const r = await query(sql, params);
    return (r.rows as any[]).map((x) => String(x.value ?? "").trim()).filter(Boolean);
  } catch (e) {
    // Not fatal: another probe may still find the link, and the caller falls back
    // to its stored status. Logged so real ERP schema drift stays visible.
    console.error(`erpWithdrawnRequestNos(${label}):`, (e as Error).message);
    return [];
  }
}

/**
 * The warehouse issue documents (ໃບເບີກ) linked to ONE request number, found
 * through the same linkages as erpWithdrawnRequestNos — so a slip stamped only
 * on its lines, or only in a remark, still shows up on the request page instead
 * of leaving it with a bare "ເບີກແລ້ວ" and no paperwork behind it.
 */
export async function erpWithdrawalDocNos(requestNo: unknown): Promise<string[]> {
  const no = String(requestNo || "").trim();
  if (!no) return [];
  const docs = new Set<string>();
  const collect = (values: string[]) => values.forEach((d) => docs.add(d));

  collect(
    await probe(
      "slips:header",
      `SELECT DISTINCT t.doc_no AS value
         FROM ic_trans t
        WHERE t.doc_ref = $1 AND t.doc_no <> t.doc_ref AND ${notMirror("t")} AND ${live("t")}`,
      [no],
    ),
  );
  collect(
    await probe(
      "slips:detail",
      `SELECT DISTINCT d.doc_no AS value
         FROM ic_trans_detail d
        WHERE d.doc_ref = $1 AND d.doc_no <> d.doc_ref AND ${notMirror("d")}
          AND EXISTS (SELECT 1 FROM ic_trans t WHERE t.doc_no = d.doc_no AND ${live("t")})`,
      [no],
    ),
  );
  collect(
    await probe(
      "slips:remark",
      `SELECT DISTINCT t.doc_no AS value
         FROM ic_trans t
        WHERE t.remark LIKE '%' || $1 || '%' AND t.doc_no <> $1 AND ${notMirror("t")} AND ${live("t")}
        UNION
       SELECT DISTINCT d.doc_no AS value
         FROM ic_trans_detail d
        WHERE d.remark LIKE '%' || $1 || '%' AND d.doc_no <> $1 AND ${notMirror("d")}
          AND EXISTS (SELECT 1 FROM ic_trans t WHERE t.doc_no = d.doc_no AND ${live("t")})`,
      [no],
    ),
  );
  return [...docs];
}

/**
 * request_no → the warehouse issue documents raised against it, for a whole
 * list in one round trip. Uses only the indexed header/line links (not the
 * free-text probe), so it is cheap enough for a 500-row list screen.
 */
export async function erpWithdrawalDocMap(requestNos: unknown[]): Promise<Map<string, string[]>> {
  const nos = [...new Set(requestNos.map((n) => String(n || "").trim()).filter(Boolean))];
  const map = new Map<string, string[]>();
  if (!nos.length) return map;
  const add = (rows: { request_no: string; doc_no: string }[]) => {
    for (const r of rows) {
      const key = String(r.request_no || "").trim();
      const doc = String(r.doc_no || "").trim();
      if (!key || !doc) continue;
      const list = map.get(key) || [];
      if (!list.includes(doc)) list.push(doc);
      map.set(key, list);
    }
  };
  try {
    const r = await query(
      `SELECT t.doc_ref AS request_no, t.doc_no
         FROM ic_trans t
        WHERE t.doc_ref = ANY($1::text[]) AND t.doc_no <> t.doc_ref AND ${notMirror("t")} AND ${live("t")}
        UNION
       SELECT d.doc_ref AS request_no, d.doc_no
         FROM ic_trans_detail d
        WHERE d.doc_ref = ANY($1::text[]) AND d.doc_no <> d.doc_ref AND ${notMirror("d")}
          AND EXISTS (SELECT 1 FROM ic_trans t WHERE t.doc_no = d.doc_no AND ${live("t")})`,
      [nos],
    );
    add(r.rows as any[]);
  } catch (e) {
    console.error("erpWithdrawalDocMap:", (e as Error).message);
  }
  return map;
}

/**
 * Request numbers the ERP has already served ("ເບີກແລ້ວ").
 *
 * A requisition is mirrored into SML as its own ic_trans document
 * (doc_no = request_no, trans_type/flag 3/122, doc_success = 0). How the
 * warehouse then records the actual issue varies by SML version, so every known
 * linkage is probed and the results unioned — each probe only runs for the
 * request numbers the earlier ones did not explain:
 *
 *   1. the mirror document is marked served — ic_trans.doc_success <> 0
 *   2. an issue document references it      — ic_trans.doc_ref = request_no
 *   3. only its lines reference it          — ic_trans_detail.doc_ref = request_no
 *   4. it is only named in free text        — ic_trans(_detail).remark mentions it
 *
 * (2)–(4) ignore the request's own mirror rows and anything cancelled. Probe (4)
 * scans remarks once and matches in JS instead of sending one LIKE per request
 * number, so its cost does not grow with the size of the list being checked.
 *
 * Both sets come back empty if ic_trans is unreachable, so every caller falls
 * back to the status it has stored rather than losing the request altogether.
 *
 * `deep` enables probe (4). It is worth a remark scan when opening one request;
 * list screens leave it off so their cost stays at two indexed lookups whatever
 * the number of still-open requests they are checking.
 */
export async function erpWithdrawnRequestNos(requestNos: unknown[], opts: { deep?: boolean } = {}): Promise<ErpWithdrawn> {
  const nos = [...new Set(requestNos.map((n) => String(n || "").trim()).filter(Boolean))];
  const linked = new Set<string>();
  const all = new Set<string>();
  if (!nos.length) return { all, linked };
  const add = (values: string[], structured: boolean) => {
    for (const v of values) {
      all.add(v);
      if (structured) linked.add(v);
    }
  };
  const missing = () => nos.filter((n) => !all.has(n));

  // 1 + 2 — the header-level links, both index-friendly, in one round trip.
  add(
    await probe(
      "header",
      `SELECT DISTINCT t.doc_ref AS value
         FROM ic_trans t
        WHERE t.doc_ref = ANY($1::text[]) AND t.doc_no <> t.doc_ref AND ${notMirror("t")} AND ${live("t")}
        UNION
       SELECT t.doc_no AS value
         FROM ic_trans t
        WHERE t.doc_no = ANY($1::text[]) AND t.trans_type = $2 AND t.trans_flag = $3
          AND COALESCE(t.doc_success, 0) <> 0 AND ${live("t")}`,
      [nos, IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG],
    ),
    true,
  );
  if (!missing().length) return { all, linked };

  // 3 — some SML builds stamp the reference on the lines only.
  add(
    await probe(
      "detail",
      `SELECT DISTINCT d.doc_ref AS value
         FROM ic_trans_detail d
        WHERE d.doc_ref = ANY($1::text[]) AND d.doc_no <> d.doc_ref AND ${notMirror("d")}
          AND EXISTS (SELECT 1 FROM ic_trans t WHERE t.doc_no = d.doc_no AND ${live("t")})`,
      [missing(), IC_TRANS_REQUEST_TYPE, IC_TRANS_REQUEST_FLAG],
    ),
    true,
  );

  const stillMissing = missing();
  if (!stillMissing.length || !opts.deep) return { all, linked };

  // 4 — last resort: the request number typed into a remark. Matched on the
  // number's prefix ("RQ-%", "REQ-%") — a couple of patterns whatever the list
  // size — then narrowed in JS. Not treated as a structured link: it is a hint,
  // not a reference, so it shows in the UI but is never persisted.
  const prefixes = [...new Set(stillMissing.map((n) => `%${n.split("-")[0]}-%`))];
  const remarks = await probe(
    "remark",
    `SELECT DISTINCT m.value FROM (
       SELECT t.remark AS value
         FROM ic_trans t
        WHERE t.remark LIKE ANY($1::text[]) AND ${notMirror("t")} AND ${live("t")}
       UNION ALL
       SELECT d.remark AS value
         FROM ic_trans_detail d
        WHERE d.remark LIKE ANY($1::text[]) AND ${notMirror("d")}
          AND EXISTS (SELECT 1 FROM ic_trans t WHERE t.doc_no = d.doc_no AND ${live("t")})
     ) m`,
    [prefixes],
  );
  for (const remark of remarks) {
    for (const no of stillMissing) if (remark.includes(no)) all.add(no);
  }

  return { all, linked };
}
