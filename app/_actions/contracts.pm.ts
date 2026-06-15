"use server";

/**
 * Drizzle / pm.contracts drop-in for app/_actions/contracts.ts. Same API + legacy
 * snake_case rows (incl. sales/accounting approval flags). NOT wired in — switch
 * over after pm.contracts is backfilled (0004/0005). See quotations.pm.ts.
 *
 * pm consolidated the two legacy contract tables into one, so getAllContractsForList
 * no longer needs an ERP merge. pm dropped contract LINE items + discount/tax, so
 * those map to []/0 — the UI's contract amount + approvals are preserved.
 */
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/_db/client";
import { contracts, quotations, projects } from "@/_db/schema";

type Fail = { success: false; message: string; [k: string]: unknown };
const fail = (message: string, extra: Record<string, unknown> = {}): Fail => ({ success: false, message, ...extra });
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
/** Parse a positive integer row id, or null. Guards against Number("")===0 silently targeting row 0. */
const toId = (v: unknown): number | null => {
  const raw = String(v ?? "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : null;
};
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));
const dateOrNull = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 10) : null;
};

const STATUS_TO_LEGACY: Record<string, string> = {
  active: "active",
  awaiting_sales: "awaiting",
  awaiting_accounting: "awaiting",
  draft: "draft",
  closed: "closed",
  cancelled: "cancelled",
};

async function resolvePm(table: "projects" | "quotations", id: unknown): Promise<number | null> {
  const raw = String(id ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  const t = table === "projects" ? projects : quotations;
  const rows = await db.select({ id: t.id }).from(t).where(or(eq(t.id, n), eq(t.legacyId, n))).limit(1);
  return rows[0]?.id ?? null;
}

function toLegacy(c: typeof contracts.$inferSelect, projectName: string | null) {
  return {
    id: c.id,
    contract_no: c.contractNo,
    quotation_id: c.quotationId,
    project_id: c.projectId,
    project_name: projectName,
    customer_name: c.customerName,
    customer_address: c.customerAddress,
    customer_phone: c.customerPhone,
    sign_date: c.signDate,
    start_date: c.startDate,
    end_date: c.endDate,
    payment_terms: c.paymentType,
    discount: 0,
    tax: 0,
    tax_type: "0",
    subtotal: c.amount,
    total_amount: c.amount,
    notes: c.notes,
    status: STATUS_TO_LEGACY[c.status] ?? c.status,
    items: [],
    contract_pdf_url: c.pdfUrl,
    sales_approved: c.salesApproved,
    sales_approver: c.salesApprover,
    accounting_approved: c.accountingApproved,
    accounting_approver: c.accountingApprover,
    created_at: iso(c.createdAt),
    updated_at: iso(c.updatedAt),
    src: "v2",
  };
}

export async function getContracts(
  opts: { projectId?: string; quotationId?: string; status?: string; search?: string } = {},
): Promise<{ success: true; data: unknown[] } | Fail> {
  try {
    const conds = [];
    if (opts.projectId) {
      const pid = await resolvePm("projects", opts.projectId);
      if (pid == null) return { success: true, data: [] };
      conds.push(eq(contracts.projectId, pid));
    }
    if (opts.quotationId) {
      const qid = await resolvePm("quotations", opts.quotationId);
      if (qid == null) return { success: true, data: [] };
      conds.push(eq(contracts.quotationId, qid));
    }
    if (opts.search) {
      const kw = `%${opts.search}%`;
      conds.push(or(ilike(contracts.contractNo, kw), ilike(contracts.customerName, kw), ilike(projects.name, kw)));
    }
    const rows = await db
      .select({ c: contracts, projectName: projects.name })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(contracts.createdAt))
      .limit(500);
    return { success: true, data: rows.map((r) => toLegacy(r.c, r.projectName)) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getAllContractsForList(): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const rows = await db
      .select({ c: contracts, projectName: projects.name })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .orderBy(desc(contracts.createdAt))
      .limit(1000);
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.c.id,
        contract_no: r.c.contractNo,
        project_name: r.projectName,
        customer_name: r.c.customerName,
        project_id: r.c.projectId != null ? String(r.c.projectId) : "",
        total_amount: r.c.amount,
        created_at: iso(r.c.createdAt),
        sales_approved: r.c.salesApproved,
        accounting_approved: r.c.accountingApproved,
        src: "v2",
      })),
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createContract(body: any, opts: { fromQuotation?: string } = {}): Promise<{ success: true; data: unknown } | Fail> {
  try {
    if (opts.fromQuotation) {
      const qid = await resolvePm("quotations", opts.fromQuotation);
      if (qid == null) return fail("Quotation not found");
      const qrows = await db.select().from(quotations).where(eq(quotations.id, qid)).limit(1);
      const src = qrows[0];
      if (!src) return fail("Quotation not found");
      if (src.status !== "approved") return fail("Only approved quotations can be converted to contracts");
      const existing = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.quotationId, qid)).limit(1);
      if (existing.length) return fail("Contract already exists for this quotation", { contract_id: existing[0].id });
      body = {
        customer_name: src.customerName,
        customer_address: src.customerAddress,
        customer_phone: src.customerPhone,
        total_amount: src.totalAmount,
        ...body,
        project_id: src.projectId,
        quotation_id: qid,
      };
    }

    const pid = body.project_id != null ? await resolvePm("projects", body.project_id) : null;
    if (pid == null) return fail("project_id is required (must exist in pm.projects)");

    // Enforce 1 project = 1 contract.
    const dup = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.projectId, pid)).limit(1);
    if (dup.length) return fail("ໂຄງການນີ້ມີສັນຍາແລ້ວ (1 ໂຄງການ = 1 ສັນຍາ)", { contract_id: dup[0].id });

    const contractNo = body.contract_no || `CT-${Date.now()}`;
    const qid = body.quotation_id != null ? await resolvePm("quotations", body.quotation_id) : null;

    const inserted = await db
      .insert(contracts)
      .values({
        contractNo: String(contractNo),
        projectId: pid,
        quotationId: qid,
        customerName: body.customer_name || null,
        customerAddress: body.customer_address || null,
        customerPhone: body.customer_phone || null,
        signDate: dateOrNull(body.sign_date) ?? dateOrNull(new Date().toISOString()),
        startDate: dateOrNull(body.start_date),
        endDate: dateOrNull(body.end_date),
        paymentType: body.payment_terms || null,
        amount: String(num(body.total_amount)),
        notes: body.notes || null,
        status: "draft",
        pdfUrl: body.contract_pdf_url || null,
      })
      .returning();
    return { success: true, data: inserted[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** In pm the two legacy contract tables are unified, so this also reads pm.contracts. */
export async function getLegacyContract(contractNo: string): Promise<{ success: true; data: any } | Fail> {
  try {
    const rows = await db
      .select({ c: contracts, projectName: projects.name })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .where(eq(contracts.contractNo, decodeURIComponent(contractNo)))
      .limit(1);
    if (!rows.length) return fail("Contract not found");
    return { success: true, data: { ...toLegacy(rows[0].c, rows[0].projectName), src: "erp" } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getContract(id: string): Promise<Record<string, unknown> | Fail> {
  try {
    const rows = await db
      .select({ c: contracts, projectName: projects.name })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .where(eq(contracts.id, Number(id)))
      .limit(1);
    if (!rows.length) return fail("Contract not found");
    return toLegacy(rows[0].c, rows[0].projectName);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function updateContract(id: string, body: any): Promise<{ success: true; data: unknown } | Fail> {
  try {
    const n = toId(id);
    if (n == null) return fail("Contract not found");
    const set: Partial<typeof contracts.$inferInsert> = {
      customerName: body.customer_name || null,
      customerAddress: body.customer_address || null,
      customerPhone: body.customer_phone || null,
      signDate: dateOrNull(body.sign_date),
      startDate: dateOrNull(body.start_date),
      endDate: dateOrNull(body.end_date),
      paymentType: body.payment_terms || null,
      amount: String(num(body.total_amount)),
      notes: body.notes || null,
      pdfUrl: body.contract_pdf_url || null,
      updatedAt: new Date(),
    };
    if (body.contract_no) set.contractNo = String(body.contract_no);
    if (body.project_id != null) {
      const pid = await resolvePm("projects", body.project_id);
      if (pid != null) set.projectId = pid; // never null a NOT NULL FK
    }
    const res = await db.update(contracts).set(set).where(eq(contracts.id, n)).returning();
    if (!res.length) return fail("Contract not found");
    return { success: true, data: res[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteContract(id: string): Promise<{ success: true } | Fail> {
  try {
    const n = toId(id);
    if (n == null) return fail("Contract not found");
    const res = await db.delete(contracts).where(eq(contracts.id, n)).returning({ id: contracts.id });
    if (!res.length) return fail("Contract not found");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function setContractApproval(
  id: string,
  which: "sales" | "accounting",
  approved: boolean,
  approver?: string,
): Promise<{ success: true } | Fail> {
  try {
    const n = toId(id);
    if (n == null) return fail("Contract not found");
    // Lock the row so two concurrent approvals (sales + accounting) can't each
    // read the other as still-false and clobber the combined status.
    const found = await db.transaction(async (tx) => {
      const cur = await tx
        .select({ sales: contracts.salesApproved, acc: contracts.accountingApproved })
        .from(contracts)
        .where(eq(contracts.id, n))
        .for("update")
        .limit(1);
      if (!cur.length) return false;

      const sales = which === "sales" ? approved : cur[0].sales;
      const acc = which === "accounting" ? approved : cur[0].acc;
      const status: typeof contracts.$inferInsert.status = sales && acc ? "active" : sales ? "awaiting_accounting" : "awaiting_sales";

      const set: Partial<typeof contracts.$inferInsert> = { status, updatedAt: new Date() };
      if (which === "sales") {
        set.salesApproved = approved;
        set.salesApprover = approver || null;
      } else {
        set.accountingApproved = approved;
        set.accountingApprover = approver || null;
      }
      await tx.update(contracts).set(set).where(eq(contracts.id, n));
      return true;
    });
    if (!found) return fail("Contract not found");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}
