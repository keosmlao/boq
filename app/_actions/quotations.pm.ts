"use server";

/**
 * Drizzle / pm.* implementation of the quotation actions — a DROP-IN for the
 * Phase-1 cut-over. It mirrors the public API of app/_actions/quotations.ts
 * (same function names, args and return shapes, incl. Lao status labels and the
 * legacy `items` array) so cut-over = point the UI imports here (or rename this
 * file over quotations.ts) with NO UI changes.
 *
 * NOT wired into the app yet. Switch over only AFTER pm.quotations is created
 * (drizzle/0000) and backfilled (drizzle/backfill/0001_quotations.sql).
 *
 * Status is stored as the pm `quotation_status` enum (English) and mapped to/from
 * the Lao labels the UI uses at this boundary. project_id accepted from the UI may
 * be either a pm id or a legacy odg id — resolvePmProjectId() handles both during
 * the transition.
 */
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/_db/client";
import { quotations, quotationLines, projects } from "@/_db/schema";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
/** Parse a positive integer row id, or null. Guards against Number("")===0 silently targeting row 0. */
const toId = (v: unknown): number | null => {
  const raw = String(v ?? "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : null;
};
const dateOrNull = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 10) : null;
};
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));

const STATUS_TO_LAO: Record<string, string> = {
  approved: "ອະນຸມັດແລ້ວ",
  rejected: "ປະຕິເສດ",
  pending: "ລໍຖ້າອະນຸມັດ",
  draft: "ລໍຖ້າອະນຸມັດ",
  expired: "ລໍຖ້າອະນຸມັດ",
};
type PmStatus = "approved" | "rejected" | "pending";
const laoToStatus = (s: unknown): PmStatus => {
  const v = String(s ?? "");
  return v === "ອະນຸມັດແລ້ວ" ? "approved" : v === "ປະຕິເສດ" ? "rejected" : "pending";
};

/** Accept a pm id OR a legacy odg id and return the pm.projects.id (or null). */
async function resolvePmProjectId(projectId: unknown): Promise<number | null> {
  const raw = String(projectId ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(or(eq(projects.id, n), eq(projects.legacyId, n)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Map a pm quotation row (+ its project name + lines) to the legacy UI shape. */
function toLegacy(q: typeof quotations.$inferSelect, projectName: string | null, lines: (typeof quotationLines.$inferSelect)[]) {
  return {
    id: q.id,
    quotation_no: q.quotationNo,
    project_id: q.projectId,
    project_name: projectName,
    customer_name: q.customerName,
    customer_address: q.customerAddress,
    customer_phone: q.customerPhone,
    quotation_date: q.quotationDate,
    validity_date: q.validityDate,
    terms: q.terms,
    discount: q.discount,
    tax: q.tax,
    tax_type: q.taxType,
    subtotal: q.subtotal,
    total_amount: q.totalAmount,
    notes: q.notes,
    status: STATUS_TO_LAO[q.status] ?? "ລໍຖ້າອະນຸມັດ",
    items: lines.map((l) => ({
      item_code: l.itemCode,
      description: l.description,
      unit: l.unitCode,
      qty: num(l.qty),
      unit_price: num(l.unitPrice),
      amount: num(l.amount),
    })),
    created_at: iso(q.createdAt),
    updated_at: iso(q.updatedAt),
  };
}

async function linesByQuotation(ids: number[]): Promise<Map<number, (typeof quotationLines.$inferSelect)[]>> {
  const map = new Map<number, (typeof quotationLines.$inferSelect)[]>();
  if (!ids.length) return map;
  const rows = await db
    .select()
    .from(quotationLines)
    .where(inArray(quotationLines.quotationId, ids))
    .orderBy(asc(quotationLines.lineNo));
  for (const l of rows) {
    const arr = map.get(l.quotationId) ?? [];
    arr.push(l);
    map.set(l.quotationId, arr);
  }
  return map;
}

export async function getQuotations(
  opts: { projectId?: string; status?: string; search?: string } = {},
): Promise<{ success: true; data: unknown[] } | Fail> {
  try {
    const conds = [];
    if (opts.projectId) {
      const pid = await resolvePmProjectId(opts.projectId);
      if (pid == null) return { success: true, data: [] };
      conds.push(eq(quotations.projectId, pid));
    }
    if (opts.status && opts.status !== "all") {
      conds.push(eq(quotations.status, laoToStatus(opts.status)));
    }
    if (opts.search) {
      const kw = `%${opts.search}%`;
      conds.push(or(ilike(quotations.quotationNo, kw), ilike(quotations.customerName, kw), ilike(projects.name, kw)));
    }

    const rows = await db
      .select({ q: quotations, projectName: projects.name })
      .from(quotations)
      .leftJoin(projects, eq(quotations.projectId, projects.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(quotations.createdAt))
      .limit(500);

    const byQ = await linesByQuotation(rows.map((r) => r.q.id));
    const data = rows.map((r) => toLegacy(r.q, r.projectName, byQ.get(r.q.id) ?? []));
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getQuotation(id: string): Promise<Record<string, unknown> | Fail> {
  try {
    const n = Number(id);
    const rows = await db
      .select({ q: quotations, projectName: projects.name })
      .from(quotations)
      .leftJoin(projects, eq(quotations.projectId, projects.id))
      .where(eq(quotations.id, n))
      .limit(1);
    if (!rows.length) return fail("Quotation not found");
    const lines = await db
      .select()
      .from(quotationLines)
      .where(eq(quotationLines.quotationId, n))
      .orderBy(asc(quotationLines.lineNo));
    return toLegacy(rows[0].q, rows[0].projectName, lines);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createQuotation(body: any): Promise<{ success: true; data: unknown } | Fail> {
  try {
    if (!body?.quotation_no) return fail("quotation_no is required");
    const pid = body.project_id ? await resolvePmProjectId(body.project_id) : null;

    // Enforce 1 project = 1 quotation (a rejected one may be replaced).
    if (pid != null) {
      const existing = await db
        .select({ status: quotations.status })
        .from(quotations)
        .where(eq(quotations.projectId, pid));
      if (existing.some((r) => r.status !== "rejected")) {
        return fail("ໂຄງການນີ້ມີໃບສະເໜີແລ້ວ (1 ໂຄງການ = 1 ໃບສະເໜີ)");
      }
    }

    // Header + lines in one transaction so a failed line write can't leave a
    // quotation with zero items.
    const created = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(quotations)
        .values({
          quotationNo: String(body.quotation_no),
          projectId: pid,
          customerName: body.customer_name || null,
          customerAddress: body.customer_address || null,
          customerPhone: body.customer_phone || null,
          quotationDate: dateOrNull(body.quotation_date),
          validityDate: dateOrNull(body.validity_date),
          terms: body.terms || null,
          notes: body.notes || null,
          discount: String(num(body.discount)),
          tax: String(num(body.tax)),
          taxType: body.tax_type || "0",
          subtotal: String(num(body.subtotal)),
          totalAmount: String(num(body.total_amount)),
          status: laoToStatus(body.status || "ລໍຖ້າອະນຸມັດ"),
        })
        .returning();
      await replaceLines(tx, inserted[0].id, body.items);
      return inserted[0];
    });
    return { success: true, data: created };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function updateQuotation(id: string, body: any): Promise<{ success: true; data: unknown } | Fail> {
  try {
    const n = toId(id);
    if (n == null) return fail("Quotation not found");
    const set: Partial<typeof quotations.$inferInsert> = {
      projectId: body.project_id ? await resolvePmProjectId(body.project_id) : null,
      customerName: body.customer_name || null,
      customerAddress: body.customer_address || null,
      customerPhone: body.customer_phone || null,
      quotationDate: dateOrNull(body.quotation_date),
      validityDate: dateOrNull(body.validity_date),
      terms: body.terms || null,
      notes: body.notes || null,
      discount: String(num(body.discount)),
      tax: String(num(body.tax)),
      taxType: body.tax_type || "0",
      subtotal: String(num(body.subtotal)),
      totalAmount: String(num(body.total_amount)),
      updatedAt: new Date(),
    };
    if (body.quotation_no) set.quotationNo = String(body.quotation_no);
    if (body.status) set.status = laoToStatus(body.status);

    const updated = await db.transaction(async (tx) => {
      const res = await tx.update(quotations).set(set).where(eq(quotations.id, n)).returning();
      if (!res.length) return null;
      await replaceLines(tx, n, body.items);
      return res[0];
    });
    if (!updated) return fail("Quotation not found");
    return { success: true, data: updated };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Update ONLY the status (approve/reject) — never touches the other fields. */
export async function approveQuotation(id: string, status: string): Promise<{ success: true } | Fail> {
  try {
    const n = toId(id);
    if (n == null) return fail("Quotation not found");
    const res = await db
      .update(quotations)
      .set({ status: laoToStatus(status), updatedAt: new Date() })
      .where(eq(quotations.id, n))
      .returning({ id: quotations.id });
    if (!res.length) return fail("Quotation not found");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteQuotation(id: string): Promise<{ success: true } | Fail> {
  try {
    const n = toId(id);
    if (n == null) return fail("Quotation not found");
    const res = await db
      .delete(quotations)
      .where(eq(quotations.id, n))
      .returning({ id: quotations.id });
    if (!res.length) return fail("Quotation not found");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Executor that may be the root db or an open transaction. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Replace a quotation's line items (delete + re-insert) — mirrors the JSONB write. */
async function replaceLines(executor: Executor, quotationId: number, items: unknown): Promise<void> {
  await executor.delete(quotationLines).where(eq(quotationLines.quotationId, quotationId));
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return;
  await executor.insert(quotationLines).values(
    list.map((it: any, i: number) => ({
      quotationId,
      lineNo: i + 1,
      itemCode: it.item_code || null,
      description: it.description || it.item_name || null,
      unitCode: it.unit || it.unit_code || null,
      qty: String(num(it.qty)),
      unitPrice: String(num(it.unit_price)),
      amount: String(num(it.amount ?? num(it.qty) * num(it.unit_price))),
      remark: it.remark || null,
    })),
  );
}
