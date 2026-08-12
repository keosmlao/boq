"use server";

/**
 * ຂໍຊື້ — what still has to be bought.
 *
 * Demand is derived, never stored: for every project that is still open, the
 * BOQ says what the job needs and ic_trans says what has already left the
 * warehouse. What is left is what the company is still on the hook to supply:
 *
 *     ຄວາມຕ້ອງການ (demand)  = BOQ ຂອງໂຄງການທີ່ຍັງບໍ່ປິດ − ທີ່ເບີກໄປແລ້ວ
 *     ຂາດ (shortfall)        = demand − stock ຄົງເຫຼືອ − ທີ່ສັ່ງຊື້ໄປແລ້ວ
 *
 * A request that is raised but not yet withdrawn still needs stock, so it stays
 * inside demand — only an actual withdrawal reduces it.
 */

import { query } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";
import { ensurePurchaseSchema } from "@/_lib/schemas/purchase";
import { ensureRequestSchema } from "@/_lib/schemas/request";
import { getSmlUnits, sameUnit } from "@/_lib/sml-units";
import { logActivity } from "./chatter";
import { cached, invalidate } from "@/_lib/cache";

/**
 * The BOQ + withdrawal + stock roll-up is the expensive part (it touches every
 * open project and calls the ERP stock function per item), so it is computed
 * ONCE per minute per server and then filtered / sorted / paged in memory HERE.
 * The browser only ever receives the page it displays — never the whole table.
 */
const DEMAND_TTL = 60 * 1000;
const DEMAND_KEY = "purchase:demand";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const codeOf = (v: unknown) => String(v ?? "").trim();

/** Statuses that still cover a shortfall (goods ordered but not yet in stock). */
const OPEN_PO_STATUSES = ["ordered"];

export type DemandRow = {
  item_code: string;
  item_name: string;
  /** The item's unit per SML (ic_inventory) — the master. */
  unit: string;
  /** Unit written on the BOQ line, kept so a disagreement stays visible. */
  boq_unit: string;
  /** Unit the ERP reports the stock balance in. */
  stock_unit: string;
  /** true when BOQ / stock / master units disagree — figures must NOT be mixed. */
  unit_mismatch: boolean;
  boq_qty: number;
  withdrawn_qty: number;
  demand_qty: number;
  stock_qty: number;
  ordered_qty: number;
  /** null when the units disagree: a shortfall across units would be a fiction. */
  shortfall_qty: number | null;
  projects: string[];
};

/**
 * Open-project BOQ totals and what has already been withdrawn against them.
 * ERP BOQs (odg_projects_boq) are the source of truth for quantities; the
 * withdrawal side is ic_trans, reached through whichever request document
 * (legacy REQ- or v2 RQ-) the warehouse issued against.
 */
async function loadBoqDemand(): Promise<Map<string, DemandRow>> {
  const map = new Map<string, DemandRow>();
  const rowFor = (code: string): DemandRow => {
    const existing = map.get(code);
    if (existing) return existing;
    const fresh: DemandRow = {
      item_code: code,
      item_name: "",
      unit: "",
      boq_unit: "",
      stock_unit: "",
      unit_mismatch: false,
      boq_qty: 0,
      withdrawn_qty: 0,
      demand_qty: 0,
      stock_qty: 0,
      ordered_qty: 0,
      shortfall_qty: 0,
      projects: [],
    };
    map.set(code, fresh);
    return fresh;
  };

  // BOQ of every project that is not closed.
  const boq = await query(
    `SELECT trim(d.item_code) AS item_code,
            max(d.item_name)  AS item_name,
            max(d.unit_code)  AS unit_code,
            SUM(d.qty)::numeric AS boq_qty,
            array_agg(DISTINCT p.project_name) FILTER (WHERE p.project_name IS NOT NULL) AS projects
       FROM odg_projects p
       JOIN odg_projects_boq b        ON b.project_id::text = p.id::text
       JOIN odg_projects_boq_detail d ON d.doc_no = b.doc_no
      WHERE COALESCE(p.project_status, '') <> 'ປິດໂຄງການ'
        AND trim(COALESCE(d.item_code, '')) <> ''
      GROUP BY trim(d.item_code)`,
  );
  for (const r of boq.rows as any[]) {
    const row = rowFor(codeOf(r.item_code));
    row.item_name = String(r.item_name || "").trim();
    row.boq_unit = String(r.unit_code || "").trim();
    row.unit = row.boq_unit; // replaced by the SML master unit below when known
    row.boq_qty += num(r.boq_qty);
    row.projects = Array.isArray(r.projects) ? r.projects.map(String) : [];
  }

  // Withdrawn against those projects — the ic_trans issue documents raised
  // against either request generation, keyed back to the item code.
  try {
    const withdrawn = await query(
      `WITH open_projects AS (
         SELECT id FROM odg_projects WHERE COALESCE(project_status, '') <> 'ປິດໂຄງການ'
       ),
       request_docs AS (
         -- legacy requests (REQ-…) belonging to an open project
         SELECT r.doc_no
           FROM odg_requests r
           JOIN open_projects p ON p.id::text = r.project_id::text
         UNION
         -- v2 requisitions (RQ-…) belonging to an open project
         SELECT q.request_no AS doc_no
           FROM odg_request q
           JOIN open_projects p ON p.id::text = q.project_id
          WHERE COALESCE(q.status, '') <> 'rejected'
       )
       SELECT trim(d.item_code) AS item_code, SUM(d.qty)::numeric AS qty
         FROM ic_trans t
         JOIN ic_trans_detail d ON d.doc_no = t.doc_no
        WHERE t.doc_ref IN (SELECT doc_no FROM request_docs)
          AND t.doc_no <> t.doc_ref
          AND COALESCE(t.is_cancel, 0) = 0
        GROUP BY trim(d.item_code)`,
    );
    for (const r of withdrawn.rows as any[]) {
      const code = codeOf(r.item_code);
      if (!code || !map.has(code)) continue;
      rowFor(code).withdrawn_qty += num(r.qty);
    }
  } catch (e) {
    // ic_trans unreachable — demand then reads as the full BOQ, which
    // over-orders rather than silently under-ordering. Logged either way.
    console.error("getPurchaseDemand: withdrawal read failed:", (e as Error).message);
  }

  return map;
}

/**
 * On-hand stock per item code, summed across every warehouse and location —
 * WITH the unit the ERP reports it in, so the comparison can check that the
 * figures are even the same kind of thing.
 */
async function loadStock(codes: string[]): Promise<Map<string, { qty: number; unit: string }>> {
  const map = new Map<string, { qty: number; unit: string }>();
  if (!codes.length) return map;
  try {
    const r = await query(
      `SELECT trim(s.ic_code) AS ic_code,
              coalesce(sum(s.balance_qty), 0)::numeric AS balance_qty,
              max(s.ic_unit_code) AS unit_code
         FROM unnest($2::text[]) AS wanted(ic_code)
         CROSS JOIN LATERAL public.sml_ic_function_stock_balance_warehouse_location(
           $1, wanted.ic_code, '', ''
         ) AS s
        WHERE trim(s.ic_code) = wanted.ic_code
        GROUP BY trim(s.ic_code)`,
      ["2099-12-31", codes],
    );
    for (const row of r.rows as any[]) {
      map.set(codeOf(row.ic_code), {
        qty: Math.max(num(row.balance_qty), 0),
        unit: String(row.unit_code || "").trim(),
      });
    }
  } catch (e) {
    console.error("getPurchaseDemand: stock read failed:", (e as Error).message);
  }
  return map;
}

/** Quantity already on order per item code (status = ordered). */
async function loadOrdered(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    await ensurePurchaseSchema();
    const r = await query(
      `SELECT trim(item_code) AS item_code, SUM(qty)::numeric AS qty
         FROM odg_purchase_request
        WHERE status = ANY($1::text[])
        GROUP BY trim(item_code)`,
      [OPEN_PO_STATUSES],
    );
    for (const row of r.rows as any[]) map.set(codeOf(row.item_code), num(row.qty));
  } catch (e) {
    console.error("getPurchaseDemand: purchase read failed:", (e as Error).message);
  }
  return map;
}

/**
 * The full picture, ONE row per BOQ item of the open projects — never the whole
 * product catalogue. Built once and cached for a minute, because it touches
 * every open project's BOQ, the withdrawal history and the ERP stock function.
 *
 * Everything downstream (search, tabs, sort, paging) runs against this snapshot
 * ON THE SERVER, so a page load ships 25 rows instead of the whole table.
 */
async function loadDemandSnapshot(): Promise<DemandRow[]> {
  return cached(DEMAND_KEY, DEMAND_TTL, async () => {
    await ensureRequestSchema();
    const demand = await loadBoqDemand();
    const codes = [...demand.keys()];
    const [stock, ordered, masterUnits] = await Promise.all([
      loadStock(codes),
      loadOrdered(),
      getSmlUnits(codes),
    ]);
    return [...demand.values()].map((row) => {
      const demandQty = Math.max(row.boq_qty - row.withdrawn_qty, 0);
      const onHand = stock.get(row.item_code);
      const stockQty = onHand?.qty ?? 0;
      const stockUnit = onHand?.unit ?? "";
      const orderedQty = ordered.get(row.item_code) || 0;
      // SML's item master decides the unit; the BOQ line and the stock balance
      // are then checked against it. Any disagreement means these quantities
      // are not on the same scale, so no shortfall is computed from them.
      const master = masterUnits.get(row.item_code) || row.boq_unit || stockUnit;
      const mismatch = !sameUnit(master, row.boq_unit) || !sameUnit(master, stockUnit);
      return {
        ...row,
        unit: master,
        stock_unit: stockUnit,
        unit_mismatch: mismatch,
        demand_qty: demandQty,
        stock_qty: stockQty,
        ordered_qty: orderedQty,
        shortfall_qty: mismatch ? null : Math.max(demandQty - stockQty - orderedQty, 0),
      };
    });
  });
}

export type DemandQuery = {
  q?: string;
  /** short = ຕ້ອງຊື້, enough = ພຽງພໍ, unit_mismatch = ຫົວໜ່ວຍບໍ່ຕົງ, all = ທັງໝົດ */
  tab?: "all" | "short" | "enough" | "unit_mismatch";
  sort?: "item_name" | "demand_qty" | "stock_qty" | "ordered_qty" | "shortfall_qty";
  dir?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export type DemandPage = {
  rows: DemandRow[];
  total: number;
  page: number;
  perPage: number;
  counts: { all: number; short: number; enough: number; unit_mismatch: number };
  summary: { items: number; shortItems: number; shortQty: number; unitMismatch: number };
};

/**
 * One page of the BOQ-vs-stock table. Search, tab, sort and paging are all
 * applied here; the client renders exactly what it receives.
 */
export async function getBoqStock(params: DemandQuery = {}): Promise<{ success: true; data: DemandPage } | Fail> {
  try {
    await requirePermission("inventory", "view");
    const all = await loadDemandSnapshot();

    const kw = String(params.q || "").trim().toLowerCase();
    const searched = kw
      ? all.filter((r) => `${r.item_code} ${r.item_name}`.toLowerCase().includes(kw))
      : all;

    // A row whose units disagree is neither "short" nor "enough" — it is
    // unusable until the unit is fixed, so it gets its own tab.
    const isShort = (r: DemandRow) => (r.shortfall_qty ?? 0) > 0;
    const isEnough = (r: DemandRow) => r.shortfall_qty !== null && r.shortfall_qty <= 0;
    const counts = {
      all: searched.length,
      short: searched.filter(isShort).length,
      enough: searched.filter(isEnough).length,
      unit_mismatch: searched.filter((r) => r.unit_mismatch).length,
    };
    const tab = params.tab || "all";
    const filtered =
      tab === "short"
        ? searched.filter(isShort)
        : tab === "enough"
          ? searched.filter(isEnough)
          : tab === "unit_mismatch"
            ? searched.filter((r) => r.unit_mismatch)
            : searched;

    const key = params.sort || "shortfall_qty";
    const dir = params.dir === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      if (key === "item_name") return String(a.item_name || a.item_code).localeCompare(String(b.item_name || b.item_code)) * dir;
      // null shortfall (unit mismatch) sorts as 0 so those rows do not pretend
      // to be the biggest gap on the list.
      const av = Number(a[key] ?? 0) || 0;
      const bv = Number(b[key] ?? 0) || 0;
      return (av - bv) * dir || a.item_code.localeCompare(b.item_code);
    });

    const perPage = Math.min(Math.max(Number(params.perPage) || 25, 5), 100);
    const total = sorted.length;
    const page = Math.min(Math.max(Number(params.page) || 1, 1), Math.max(Math.ceil(total / perPage), 1));
    const rows = sorted.slice((page - 1) * perPage, page * perPage);

    return {
      success: true,
      data: {
        rows,
        total,
        page,
        perPage,
        counts,
        summary: {
          items: all.length,
          shortItems: all.filter((r) => (r.shortfall_qty ?? 0) > 0).length,
          shortQty: all.reduce((s, r) => s + (r.shortfall_qty ?? 0), 0),
          unitMismatch: all.filter((r) => r.unit_mismatch).length,
        },
      },
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Everything, for the Excel export only — never rendered row by row. */
export async function getBoqStockForExport(params: { q?: string; tab?: DemandQuery["tab"] } = {}): Promise<
  { success: true; data: DemandRow[] } | Fail
> {
  try {
    await requirePermission("inventory", "view");
    const all = await loadDemandSnapshot();
    const kw = String(params.q || "").trim().toLowerCase();
    const tab = params.tab || "all";
    return {
      success: true,
      data: all
        .filter((r) => !kw || `${r.item_code} ${r.item_name}`.toLowerCase().includes(kw))
        .filter((r) =>
          tab === "short"
            ? (r.shortfall_qty ?? 0) > 0
            : tab === "enough"
              ? r.shortfall_qty !== null && r.shortfall_qty <= 0
              : tab === "unit_mismatch"
                ? r.unit_mismatch
                : true,
        ),
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export type PurchaseLine = {
  id: number;
  pr_no: string;
  item_code: string;
  item_name: string;
  unit: string;
  qty: number;
  status: string;
  supplier: string | null;
  note: string | null;
  requester: string | null;
  ordered_at: string | null;
  created_at: string;
};

/**
 * One page of purchase lines, newest first. Filtered and paged in SQL — the
 * table can grow for years without the page load growing with it.
 */
export async function getPurchaseLines(
  params: { q?: string; page?: number; perPage?: number } = {},
): Promise<{ success: true; data: { rows: PurchaseLine[]; total: number; page: number; perPage: number } } | Fail> {
  try {
    await requirePermission("purchase", "view");
    await ensurePurchaseSchema();
    const kw = String(params.q || "").trim();
    const perPage = Math.min(Math.max(Number(params.perPage) || 25, 5), 100);
    const page = Math.max(Number(params.page) || 1, 1);
    const where = kw ? `WHERE item_code ILIKE $3 OR item_name ILIKE $3 OR pr_no ILIKE $3` : "";
    const args: unknown[] = [perPage, (page - 1) * perPage];
    if (kw) args.push(`%${kw}%`);

    const [rows, count] = await Promise.all([
      query(`SELECT * FROM odg_purchase_request ${where} ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`, args),
      query(`SELECT count(*)::int AS n FROM odg_purchase_request ${kw ? `WHERE item_code ILIKE $1 OR item_name ILIKE $1 OR pr_no ILIKE $1` : ""}`,
        kw ? [`%${kw}%`] : []),
    ]);
    return {
      success: true,
      data: { rows: rows.rows as PurchaseLine[], total: Number((count.rows[0] as any)?.n || 0), page, perPage },
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Record an order (one ຂໍຊື້ document covering one or more items). */
export async function createPurchaseOrder(body: {
  items: Array<{ item_code: string; item_name?: string; unit?: string; qty: number }>;
  supplier?: string;
  note?: string;
}): Promise<{ success: true; data: { pr_no: string; lines: number } } | Fail> {
  try {
    const user = await requirePermission("purchase", "create");
    await ensurePurchaseSchema();
    const items = (Array.isArray(body?.items) ? body.items : [])
      .map((it) => ({
        item_code: codeOf(it.item_code),
        item_name: String(it.item_name || "").trim(),
        unit: String(it.unit || "").trim(),
        qty: num(it.qty),
      }))
      .filter((it) => it.item_code && it.qty > 0);
    if (!items.length) return fail("ກະລຸນາເລືອກລາຍການ ແລະ ໃສ່ຈຳນວນທີ່ຈະສັ່ງຊື້");

    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const prNo = `PR-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const requester = (user?.name || user?.username || "").toString() || null;

    for (const it of items) {
      await query(
        `INSERT INTO odg_purchase_request (pr_no, item_code, item_name, unit, qty, status, supplier, note, requester)
         VALUES ($1,$2,$3,$4,$5,'ordered',$6,$7,$8)`,
        [prNo, it.item_code, it.item_name || null, it.unit || null, it.qty, body.supplier || null, body.note || null, requester],
      );
    }
    invalidate("purchase:");
    await logActivity("purchase", prNo, "ສ້າງໃບຂໍຊື້", `${items.length} ລາຍການ`);
    return { success: true, data: { pr_no: prNo, lines: items.length } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Advance a purchase line: ordered → received (in stock) or cancelled. */
export async function setPurchaseLineStatus(id: string, status: string): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("purchase", "edit");
    await ensurePurchaseSchema();
    if (!["ordered", "received", "cancelled"].includes(status)) return fail("ສະຖານະບໍ່ຖືກຕ້ອງ");
    if (!/^\d+$/.test(String(id))) return fail("ລາຍການບໍ່ຖືກຕ້ອງ");
    const r = await query(
      `UPDATE odg_purchase_request SET status = $2, updated_at = now() WHERE id = $1 RETURNING pr_no`,
      [id, status],
    );
    if (!r.rowCount) return fail("ບໍ່ພົບລາຍການ");
    invalidate("purchase:");
    await logActivity("purchase", String(r.rows[0].pr_no || id), "ປ່ຽນສະຖານະໃບຂໍຊື້", status);
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deletePurchaseLine(id: string): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("purchase", "delete");
    await ensurePurchaseSchema();
    if (!/^\d+$/.test(String(id))) return fail("ລາຍການບໍ່ຖືກຕ້ອງ");
    const r = await query(`DELETE FROM odg_purchase_request WHERE id = $1 RETURNING pr_no`, [id]);
    if (!r.rowCount) return fail("ບໍ່ພົບລາຍການ");
    invalidate("purchase:");
    await logActivity("purchase", String(r.rows[0].pr_no || id), "ລຶບລາຍການຂໍຊື້");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}
