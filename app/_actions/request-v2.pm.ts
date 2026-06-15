"use server";

/**
 * Drizzle / pm.material_requests drop-in for app/_actions/request-v2.ts. Same API
 * + legacy snake_case rows. NOT wired in — switch over after pm.material_requests
 * is backfilled (drizzle/backfill/0002_requests.sql). See quotations.pm.ts.
 *
 * NOTE: getRequestDetail returns withdrawals: [] — the ໃບເບີກ slips live in the
 * ERP ic_trans tables (NOT migrated). Port that read (unchanged from the legacy
 * action) here at cut-over if the detail page needs to show them.
 */
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/_db/client";
import { query } from "@/_lib/db";
import { materialRequests, materialRequestLines, projects } from "@/_db/schema";
import { invalidate } from "@/_lib/cache";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));

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

function toLegacy(
  r: typeof materialRequests.$inferSelect,
  projectName: string | null,
  lines: (typeof materialRequestLines.$inferSelect)[],
) {
  return {
    id: r.id,
    request_no: r.docNo,
    doc_no: r.docNo,
    project_id: r.projectId,
    project_name: projectName,
    status: r.fulfilled ? "withdrawn" : "requested",
    requester: r.requesterName,
    notes: r.remark,
    items: lines.map((l) => ({ item_code: l.itemCode, description: l.itemName, unit: l.unitCode, qty: num(l.qty) })),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
  };
}

async function linesByRequest(ids: number[]): Promise<Map<number, (typeof materialRequestLines.$inferSelect)[]>> {
  const map = new Map<number, (typeof materialRequestLines.$inferSelect)[]>();
  if (!ids.length) return map;
  const rows = await db
    .select()
    .from(materialRequestLines)
    .where(inArray(materialRequestLines.requestId, ids))
    .orderBy(asc(materialRequestLines.lineNo));
  for (const l of rows) {
    const arr = map.get(l.requestId) ?? [];
    arr.push(l);
    map.set(l.requestId, arr);
  }
  return map;
}

export async function getRequests(opts: { projectId?: string } = {}): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const conds = [];
    if (opts.projectId) {
      const pid = await resolvePmProjectId(opts.projectId);
      if (pid == null) return { success: true, data: [] };
      conds.push(eq(materialRequests.projectId, pid));
    }
    const rows = await db
      .select({ r: materialRequests, projectName: projects.name })
      .from(materialRequests)
      .leftJoin(projects, eq(materialRequests.projectId, projects.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(materialRequests.createdAt))
      .limit(500);
    const byR = await linesByRequest(rows.map((r) => r.r.id));
    return { success: true, data: rows.map((r) => toLegacy(r.r, r.projectName, byR.get(r.r.id) ?? [])) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getRequestDetail(id: string): Promise<{ success: true; data: any } | Fail> {
  try {
    const n = Number(id);
    const rows = await db
      .select({ r: materialRequests, projectName: projects.name })
      .from(materialRequests)
      .leftJoin(projects, eq(materialRequests.projectId, projects.id))
      .where(eq(materialRequests.id, n))
      .limit(1);
    if (!rows.length) return fail("Request not found");
    const lines = await db
      .select()
      .from(materialRequestLines)
      .where(eq(materialRequestLines.requestId, n))
      .orderBy(asc(materialRequestLines.lineNo));
    // The ໃບເບີກ slips stay in the ERP ic_trans tables (read-only, not migrated).
    const withdrawals = await erpWithdrawals(rows[0].r.docNo);
    return { success: true, data: { ...toLegacy(rows[0].r, rows[0].projectName, lines), withdrawals, src: "pm" } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Linked withdrawal slips for a request doc_no — read from ERP ic_trans (unchanged). */
async function erpWithdrawals(docNo: string): Promise<any[]> {
  const withdrawals: any[] = [];
  try {
    const wt = await query(
      `SELECT doc_no, doc_date, doc_time, remark FROM ic_trans WHERE doc_ref = $1 AND COALESCE(is_cancel,0) = 0 ORDER BY doc_date, doc_time`,
      [docNo],
    );
    for (const w of wt.rows as any[]) {
      let info: any[] = [];
      try {
        info = (
          await query(
            `SELECT item_code, item_name, unit_code, qty, wh_name, shelf_name, createuser FROM odg_withdraw_info WHERE doc_no = $1`,
            [w.doc_no],
          )
        ).rows as any[];
      } catch {
        /* ignore */
      }
      if (!info.length) {
        try {
          info = (
            await query(
              `SELECT item_code, item_name, unit_code, qty, wh_code AS wh_name, shelf_code AS shelf_name, NULL AS createuser FROM ic_trans_detail WHERE doc_no = $1 ORDER BY line_number NULLS LAST, roworder`,
              [w.doc_no],
            )
          ).rows as any[];
        } catch {
          /* ignore */
        }
      }
      const uniq = (k: string) => [...new Set(info.map((x) => x[k]).filter(Boolean))];
      withdrawals.push({
        doc_no: w.doc_no,
        doc_date: w.doc_date,
        doc_time: w.doc_time,
        remark: w.remark,
        withdrawerCodes: uniq("createuser"),
        wh_name: uniq("wh_name").join(", "),
        shelf_name: uniq("shelf_name").join(", "),
        items: info,
      });
    }
    const codes = [...new Set(withdrawals.flatMap((w) => w.withdrawerCodes || []).filter(Boolean).map(String))];
    if (codes.length) {
      const e = await query(`SELECT employee_code, fullname_lo FROM odg_employee WHERE employee_code = ANY($1::text[])`, [codes]);
      const m: Record<string, string> = {};
      for (const row of e.rows as any[]) m[String(row.employee_code)] = row.fullname_lo;
      for (const w of withdrawals) w.withdrawer = (w.withdrawerCodes || []).map((c: string) => m[String(c)] || c).join(", ");
    }
  } catch {
    /* ic_trans not reachable */
  }
  return withdrawals;
}

export async function getRequestById(id: string): Promise<{ success: true; data: any } | Fail> {
  try {
    const rows = await db.select().from(materialRequests).where(eq(materialRequests.id, Number(id))).limit(1);
    if (!rows.length) return fail("Request not found");
    return { success: true, data: rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createRequest(body: any): Promise<{ success: true; data: any } | Fail> {
  try {
    if (!body?.project_id) return fail("project_id is required");
    const pid = await resolvePmProjectId(body.project_id);
    const items = (Array.isArray(body.items) ? body.items : []).filter((it: any) => num(it.qty) > 0);
    if (!items.length) return fail("ກະລຸນາໃສ່ລາຍການທີ່ຕ້ອງເບີກ");

    const d = new Date();
    const p = (x: number) => String(x).padStart(2, "0");
    const docNo =
      body.request_no ||
      `RQ-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;

    // Header + lines in one transaction so a line-insert failure can't leave a
    // request with no items.
    const req = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(materialRequests)
        .values({
          docNo,
          projectId: pid,
          requesterName: body.requester || null,
          remark: body.notes || null,
          fulfilled: body.status === "withdrawn",
        })
        .returning();
      const created = inserted[0];
      await tx.insert(materialRequestLines).values(
        items.map((it: any, i: number) => ({
          requestId: created.id,
          lineNo: i + 1,
          itemCode: it.item_code || null,
          itemName: it.description || it.item_name || null,
          unitCode: it.unit || it.unit_code || null,
          qty: String(num(it.qty)),
        })),
      );
      return created;
    });
    invalidate("req:");
    return { success: true, data: req };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function setRequestStatus(id: string, status: string): Promise<{ success: true } | Fail> {
  try {
    const res = await db
      .update(materialRequests)
      .set({ fulfilled: status === "withdrawn", updatedAt: new Date() })
      .where(eq(materialRequests.id, Number(id)))
      .returning({ id: materialRequests.id });
    if (!res.length) return fail("Request not found");
    invalidate("req:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteRequest(id: string): Promise<{ success: true } | Fail> {
  try {
    const res = await db.delete(materialRequests).where(eq(materialRequests.id, Number(id))).returning({ id: materialRequests.id });
    if (!res.length) return fail("Request not found");
    invalidate("req:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function updateRequest(id: string, body: any): Promise<{ success: true } | Fail> {
  try {
    const n = Number(id);
    const items = (Array.isArray(body?.items) ? body.items : []).filter((it: any) => num(it.qty) > 0);
    if (!items.length) return fail("ກະລຸນາໃສ່ລາຍການທີ່ຕ້ອງເບີກ");

    // Header update + full line replace in one transaction so a failure can't
    // wipe the existing lines without re-inserting the new ones.
    const found = await db.transaction(async (tx) => {
      const res = await tx
        .update(materialRequests)
        .set({ remark: body.notes ?? null, updatedAt: new Date() })
        .where(eq(materialRequests.id, n))
        .returning({ id: materialRequests.id });
      if (!res.length) return false;

      await tx.delete(materialRequestLines).where(eq(materialRequestLines.requestId, n));
      await tx.insert(materialRequestLines).values(
        items.map((it: any, i: number) => ({
          requestId: n,
          lineNo: i + 1,
          itemCode: it.item_code || null,
          itemName: it.description || it.item_name || null,
          unitCode: it.unit || it.unit_code || null,
          qty: String(num(it.qty)),
        })),
      );
      return true;
    });
    if (!found) return fail("Request not found");
    invalidate("req:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}
