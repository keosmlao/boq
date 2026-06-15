"use server";

/**
 * Drizzle / pm.boq_docs drop-in for the v2-facing BOQ reads (app/_actions/boq.ts
 * + boq-v2.ts). NOT wired in — switch over after pm.boq_docs is backfilled (0007).
 *
 * Covered: getAllBoqsForList, getBoq, deleteBoq, approveBoq, getProjectMaterials.
 * NOT covered (ERP inventory/contract-item logic — port carefully at cut-over):
 * saveBoq, updateBoqErp, getBoqContractItems, checkAccountingApprove, getListBoq.
 */
import { asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/_db/client";
import { boqDocs, boqLines, contracts, materialRequests, materialRequestLines, projects } from "@/_db/schema";
import { invalidate } from "@/_lib/cache";

type Ok = { success: true; message?: string };
type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));

const STATUS_TO_LAO: Record<string, string> = { approved: "ອະນຸມັດແລ້ວ", rejected: "ປະຕິເສດ", pending: "ລໍຖ້າອະນຸມັດ" };
const STATUS_TO_NUM: Record<string, number> = { approved: 1, rejected: 2, pending: 0 };
const numToStatus = (n: number): "approved" | "rejected" | "pending" => (n === 1 ? "approved" : n === 2 ? "rejected" : "pending");

async function resolvePmProjectId(projectId: unknown): Promise<number | null> {
  const raw = String(projectId ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  const rows = await db.select({ id: projects.id }).from(projects).where(or(eq(projects.id, n), eq(projects.legacyId, n))).limit(1);
  return rows[0]?.id ?? null;
}

export async function getAllBoqsForList(): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const rows = await db
      .select({ b: boqDocs, projectName: projects.name })
      .from(boqDocs)
      .leftJoin(projects, eq(boqDocs.projectId, projects.id))
      .orderBy(desc(boqDocs.createdAt))
      .limit(1000);
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.b.id,
        boq_no: r.b.docNo,
        project_name: r.projectName,
        customer_name: r.b.customerCode,
        total_amount: null,
        requester: r.b.createdBy,
        approver: r.b.approver,
        status: STATUS_TO_LAO[r.b.status] ?? "ລໍຖ້າອະນຸມັດ",
        created_at: iso(r.b.createdAt),
        src: "erp",
      })),
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getBoq(docNo: string): Promise<Record<string, unknown> | Fail> {
  try {
    const key = decodeURIComponent(docNo);
    const rows = await db
      .select({ b: boqDocs, projectName: projects.name })
      .from(boqDocs)
      .leftJoin(projects, eq(boqDocs.projectId, projects.id))
      .where(eq(boqDocs.docNo, key))
      .limit(1);
    if (!rows.length) return fail("BOQ not found");
    const b = rows[0].b;
    const lines = await db.select().from(boqLines).where(eq(boqLines.boqId, b.id)).orderBy(asc(boqLines.lineNo));
    return {
      doc_no: b.docNo,
      boq_no: b.docNo,
      project_id: b.projectId,
      project_name: rows[0].projectName,
      contract_id: b.contractId,
      cust_code: b.customerCode,
      doc_date: b.docDate,
      user_created: b.createdBy,
      approver: b.approver,
      approve_status: STATUS_TO_NUM[b.status] ?? 0,
      status: STATUS_TO_LAO[b.status] ?? "ລໍຖ້າອະນຸມັດ",
      items: lines.map((l) => ({ item_code: l.itemCode, item_name: l.itemName, unit_code: l.unitCode, qty: num(l.qty) })),
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteBoq(docNo: string): Promise<Ok | Fail> {
  try {
    const res = await db.delete(boqDocs).where(eq(boqDocs.docNo, decodeURIComponent(docNo))).returning({ id: boqDocs.id });
    if (!res.length) return fail("BOQ not found");
    invalidate("projects:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function approveBoq(docNo: string, payload: { status?: number; username?: string }): Promise<Ok | Fail> {
  try {
    const res = await db
      .update(boqDocs)
      .set({ status: numToStatus(num(payload.status)), approver: payload.username || null, updatedAt: new Date() })
      .where(eq(boqDocs.docNo, decodeURIComponent(docNo)))
      .returning({ id: boqDocs.id });
    if (!res.length) return fail("BOQ not found");
    invalidate("projects:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Reconcile BOQ qty vs requested vs withdrawn per item, for one project. */
export async function getProjectMaterials(projectId: string): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const pid = await resolvePmProjectId(projectId);
    if (pid == null) return { success: true, data: [] };

    const map = new Map<string, any>();
    const keyOf = (code: any, desc: any) => String(code || "").trim() || String(desc || "").trim().toLowerCase();

    // BOQ quantities (pm.boq_lines for this project's BOQ docs).
    const docs = await db.select({ id: boqDocs.id }).from(boqDocs).where(eq(boqDocs.projectId, pid));
    const docIds = docs.map((d) => d.id);
    if (docIds.length) {
      const lines = await db.select().from(boqLines).where(inArray(boqLines.boqId, docIds));
      for (const l of lines) {
        const k = keyOf(l.itemCode, l.itemName);
        if (!k) continue;
        const e = map.get(k) || { item_code: l.itemCode || "", description: l.itemName || "", unit: l.unitCode || "", boq_qty: 0, request_qty: 0, withdraw_qty: 0 };
        e.boq_qty += num(l.qty);
        if (!e.unit && l.unitCode) e.unit = l.unitCode;
        map.set(k, e);
      }
    }

    // Requested / withdrawn quantities (pm.material_requests for this project).
    const reqs = await db.select({ id: materialRequests.id, fulfilled: materialRequests.fulfilled }).from(materialRequests).where(eq(materialRequests.projectId, pid));
    const reqIds = reqs.map((r) => r.id);
    const fulfilledById = new Map(reqs.map((r) => [r.id, r.fulfilled]));
    if (reqIds.length) {
      const rlines = await db.select().from(materialRequestLines).where(inArray(materialRequestLines.requestId, reqIds));
      for (const l of rlines) {
        const e = map.get(keyOf(l.itemCode, l.itemName));
        if (!e) continue;
        if (fulfilledById.get(l.requestId)) e.withdraw_qty += num(l.qty);
        else e.request_qty += num(l.qty);
      }
    }

    const data = Array.from(map.values())
      .map((e) => ({ ...e, remaining: Math.max(num(e.boq_qty) - num(e.request_qty) - num(e.withdraw_qty), 0) }))
      .sort((a, b) => String(a.description).localeCompare(String(b.description)));
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Create a BOQ → pm.boq_docs + pm.boq_lines (pm port of the legacy ERP saveBoq). */
export async function saveBoq(
  payload: Record<string, unknown>,
): Promise<{ success: true; message: string; doc_no: string; total_items: number } | Fail> {
  try {
    const custCode = String(payload?.cust_code || "").trim();
    const projectIdRaw = String(payload?.project_id || "").trim();
    const username = String(payload?.username || "").trim();
    const contractRef = String(payload?.contract_no || "").trim();
    const docDate = String(payload?.doc_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const items = Array.isArray(payload?.items) ? (payload.items as any[]) : [];
    if (!custCode) return fail("Missing cust_code");
    if (!projectIdRaw) return fail("Missing project_id");
    if (!contractRef) return fail("Missing contract_no");

    const validItems = items
      .map((it: any) => ({
        item_code: String(it?.productId || it?.item_code || it?.code || "").trim(),
        item_name: String(it?.productName || it?.item_name || it?.name_1 || "").trim(),
        qty: num(it?.quantity ?? it?.qty),
        unit_code: String(it?.unit || it?.unit_code || "").trim(),
      }))
      .filter((it) => it.item_name && it.qty > 0);
    if (!validItems.length) return fail("Missing valid BOQ items");

    const pid = await resolvePmProjectId(projectIdRaw);
    if (pid == null) return fail("Missing project_id");

    const cnum = /^\d+$/.test(contractRef) ? Number(contractRef) : null;
    const orConds = [eq(contracts.contractNo, contractRef)];
    if (cnum != null) orConds.push(eq(contracts.legacyRoworder, cnum));
    const crow = (await db.select({ id: contracts.id }).from(contracts).where(or(...orConds)).limit(1))[0];
    if (!crow) return fail("ບໍ່ພົບສັນຍາສຳລັບອອກ BOQ");

    const docNo = await db.transaction(async (tx) => {
      const prefix = `BOQ-${docDate.slice(0, 4)}${docDate.slice(5, 7)}-`;
      const existing = await tx.select({ docNo: boqDocs.docNo }).from(boqDocs).where(sql`${boqDocs.docNo} LIKE ${prefix + "%"}`);
      let max = 0;
      for (const e of existing) {
        const m = /(\d+)$/.exec(e.docNo);
        if (m) max = Math.max(max, Number(m[1]));
      }
      const dno = `${prefix}${String(max + 1).padStart(4, "0")}`;
      const doc = (
        await tx
          .insert(boqDocs)
          .values({ docNo: dno, docDate, projectId: pid, contractId: crow.id, customerCode: custCode, createdBy: username || null, status: "pending" })
          .returning()
      )[0];
      await tx.insert(boqLines).values(
        validItems.map((it, i) => ({
          boqId: doc.id,
          lineNo: i + 1,
          itemCode: it.item_code || "UNKNOWN",
          itemName: it.item_name,
          unitCode: it.unit_code || null,
          qty: String(it.qty),
        })),
      );
      return dno;
    });

    invalidate("projects:");
    return { success: true, message: `Created ${docNo}`, doc_no: docNo, total_items: validItems.length };
  } catch (e) {
    return fail((e as Error).message);
  }
}
