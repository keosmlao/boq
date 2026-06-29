/**
 * Work-order lifecycle core — pure(ish) functions that take an already-
 * authenticated user. Shared by the web server actions (cookie session) and the
 * mobile REST API (Bearer token), so the approve → accept → check-in → check-out
 * rules live in exactly one place. Authn happens in the callers; authz (can /
 * assignment) happens here against the passed user.
 */
import { query } from "@/_lib/db";
import { invalidate } from "@/_lib/cache";
import { ensureWorkOrderSchema } from "@/_lib/schemas/work-order";
import { saveBase64File } from "@/_lib/uploads";
import { can, isManager, type Permissions } from "@/_lib/permissions";
import { notifyCraftsman, notifyManagers } from "@/_lib/push";
import { notifyManagers as notifyManagersInApp } from "@/_actions/notifications";

export type ActingUser = {
  username: string;
  name?: string;
  role?: string;
  permissions?: Permissions;
};

type Fail = { success: false; message: string };
type Ok = { success: true; data: any };
const fail = (message: string): Fail => ({ success: false, message });

const numOrNull = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const actorName = (u: ActingUser) => u.name || u.username;

async function loadWoRow(id: string): Promise<any | null> {
  const sid = String(id);
  // Legacy ERP work orders use ids like "erp-202" → load from odg_work_orders
  // (plural). The v2 table's id is BIGSERIAL, so a bare "erp-202" would crash the
  // integer cast — normalise here and expose the fields the lifecycle code needs.
  if (sid.startsWith("erp-")) {
    const realId = sid.slice(4);
    if (!/^\d+$/.test(realId)) return null;
    const r = await query(
      `SELECT id, code AS work_no, project_code AS project_id, technician_id AS technician_code,
              NULL::text AS assigned_username, NULL::timestamptz AS checkout_at, NULL::timestamptz AS closed_at
         FROM odg_work_orders WHERE id = $1 LIMIT 1`,
      [realId],
    );
    return r.rows[0] || null;
  }
  if (!/^\d+$/.test(sid)) return null; // v2 ids are numeric (BIGSERIAL)
  const r = await query(`SELECT * FROM odg_work_order WHERE id = $1 LIMIT 1`, [sid]);
  return r.rows[0] || null;
}

/** Exported loader for routes that need the raw work-order row (e.g. /boq). */
export async function loadWoRowPublic(id: string): Promise<any | null> {
  return loadWoRow(id);
}

/** May this user act on this work order as the assigned craftsman? */
function canActAsCraftsman(user: ActingUser, wo: any): boolean {
  // The assigned head craftsman: matched by assigned_username, or by the work
  // order's technician_code (= the craftsman's employee_code).
  const assigned = wo?.assigned_username ? String(wo.assigned_username) : "";
  const tech = wo?.technician_code ? String(wo.technician_code) : "";
  if (assigned) return assigned === user.username;
  if (tech) return tech === user.username;
  return true; // unassigned → any holder may act
}

/**
 * Lead technician codes whose `helpers` list includes this user — i.e. the jobs a
 * ຜູ້ຊ່ວຍຊ່າງ (assistant) may help on. Helpers live on the lead technician row
 * (odg_technicians.helpers), as codes or {code} objects. See resolveHelpers() in
 * app/_actions/workorder.ts for the same shape.
 */
export async function leadCodesForHelper(username: string): Promise<string[]> {
  if (!username) return [];
  try {
    const r = await query(`SELECT code, helpers FROM odg_technicians WHERE helpers IS NOT NULL`);
    const leads: string[] = [];
    for (const row of r.rows as any[]) {
      const codes = (Array.isArray(row.helpers) ? row.helpers : [])
        .map((h: any) => (h && typeof h === "object" ? (h.code ?? h.name_1 ?? h.name) : h))
        .map(String);
      if (codes.includes(String(username))) leads.push(String(row.code));
    }
    return leads;
  } catch {
    return [];
  }
}

/** May this user act as a ຜູ້ຊ່ວຍ on this job (helper of the job's lead technician)? */
async function canAssistOnWo(user: ActingUser, wo: any): Promise<boolean> {
  const tech = wo?.technician_code ? String(wo.technician_code) : "";
  if (!tech) return false;
  const leads = await leadCodesForHelper(user.username);
  return leads.includes(tech);
}

/**
 * May this user work the job (check-in/out, tasks, materials)? The assigned head
 * craftsman OR one of their assistants. Accept/reject stays head-craftsman only.
 */
export async function canWorkOnWo(user: ActingUser, wo: any): Promise<boolean> {
  return canActAsCraftsman(user, wo) || (await canAssistOnWo(user, wo));
}

/** Save 1+ base64 photos → public URLs (drops empties). */
async function savePhotos(list: string[], prefix: string): Promise<string[]> {
  const urls: string[] = [];
  let i = 0;
  for (const b64 of list) {
    if (!b64) continue;
    const url = await saveBase64File({ base64: b64, fileName: `${prefix}-${i++}.jpg`, relativeDir: "static/uploads" });
    if (url) urls.push(url);
  }
  return urls;
}

function assertV2Id(id: string): string | null {
  if (!id || String(id).startsWith("erp-")) return "ໃບງານນີ້ແມ່ນລະບົບເກົ່າ ບໍ່ສາມາດດຳເນີນການໄດ້";
  return null;
}

/** Manager / authorised approver approves (or rejects) an issued work order. */
export async function approveWorkOrderAs(
  user: ActingUser,
  id: string,
  opts: { approve: boolean; note?: string } = { approve: true },
): Promise<Ok | Fail> {
  try {
    const bad = assertV2Id(String(id));
    if (bad) return fail(bad);
    if (!can(user, "work-orders", "approve")) return fail("ບໍ່ມີສິດອະນຸມັດໃບງານ");
    await ensureWorkOrderSchema();
    const wo = await loadWoRow(String(id));
    if (!wo) return fail("ບໍ່ພົບໃບງານ");

    const status = opts.approve ? "approved" : "rejected";
    const r = await query(
      `UPDATE odg_work_order
          SET approval_status = $2, approver = $3, approved_at = now(), approve_note = $4
        WHERE id = $1 RETURNING *`,
      [String(id), status, actorName(user), opts.note || null],
    );
    invalidate("wo:");
    // Notify the assigned craftsman so they can accept the work.
    if (opts.approve) {
      await notifyCraftsman(
        wo.technician_code,
        "ໃບງານໄດ້ຮັບການອະນຸມັດ",
        `${wo.work_no || "ໃບງານ"} — ກະລຸນາກົດຮັບງານ`,
        { workOrderId: String(id), type: "wo_approved" },
      );
    }
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Assigned head craftsman accepts or rejects an APPROVED work order. */
export async function respondWorkOrderAs(
  user: ActingUser,
  id: string,
  opts: { accept: boolean; reason?: string },
): Promise<Ok | Fail> {
  try {
    const bad = assertV2Id(String(id));
    if (bad) return fail(bad);
    await ensureWorkOrderSchema();
    const wo = await loadWoRow(String(id));
    if (!wo) return fail("ບໍ່ພົບໃບງານ");
    if (!canActAsCraftsman(user, wo)) return fail("ໃບງານນີ້ບໍ່ໄດ້ມອບໝາຍໃຫ້ທ່ານ");
    if (wo.approval_status !== "approved") return fail("ໃບງານຍັງບໍ່ໄດ້ຮັບການອະນຸມັດ");
    if (wo.accept_status === "accepted" && opts.accept) return fail("ໄດ້ຮັບງານໄປແລ້ວ");

    const r = opts.accept
      ? await query(
          `UPDATE odg_work_order
              SET accept_status = 'accepted', accepted_by = $2, accepted_at = now(),
                  reject_reason = NULL, status = 'assigned'
            WHERE id = $1 RETURNING *`,
          [String(id), actorName(user)],
        )
      : await query(
          `UPDATE odg_work_order
              SET accept_status = 'rejected', accepted_by = $2, accepted_at = now(),
                  reject_reason = $3, status = 'open'
            WHERE id = $1 RETURNING *`,
          [String(id), actorName(user), opts.reason || null],
        );
    invalidate("wo:");
    await notifyManagers(
      opts.accept ? "ຊ່າງຮັບງານ" : "ຊ່າງປະຕິເສດງານ",
      `${actorName(user)} ${opts.accept ? "ຮັບ" : "ປະຕິເສດ"} ${wo.work_no || "ໃບງານ"}`,
      { workOrderId: String(id), type: opts.accept ? "wo_accepted" : "wo_rejected" },
    );
    await notifyManagersInApp(
      "work_order",
      String(id),
      opts.accept ? "wo_accepted" : "wo_rejected",
      `${actorName(user)} ${opts.accept ? "ຮັບງານ" : "ປະຕິເສດງານ"} ${wo.work_no || "ໃບງານ"}`,
      user.username,
      actorName(user),
    );
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** On-site check-in BEFORE starting work: requires photo(s) and GPS location. */
export async function checkInWorkOrderAs(
  user: ActingUser,
  id: string,
  opts: { lat: number; lng: number; photoBase64?: string; photos?: string[]; note?: string },
): Promise<Ok | Fail> {
  try {
    const bad = assertV2Id(String(id));
    if (bad) return fail(bad);
    await ensureWorkOrderSchema();
    const wo = await loadWoRow(String(id));
    if (!wo) return fail("ບໍ່ພົບໃບງານ");
    if (!(await canWorkOnWo(user, wo))) return fail("ໃບງານນີ້ບໍ່ໄດ້ມອບໝາຍໃຫ້ທ່ານ");
    if (wo.accept_status !== "accepted") return fail("ກະລຸນາກົດຮັບງານກ່ອນ");
    if (wo.checkin_at) return fail("ໄດ້ check-in ໄປແລ້ວ");

    const lat = numOrNull(opts.lat);
    const lng = numOrNull(opts.lng);
    if (lat === null || lng === null) return fail("ບໍ່ພົບ location — ກະລຸນາເປີດ GPS");

    const input = (opts.photos && opts.photos.length ? opts.photos : opts.photoBase64 ? [opts.photoBase64] : []).filter(Boolean);
    if (!input.length) return fail("ກະລຸນາຖ່າຍຮູບກ່ອນເລີ່ມວຽກ");
    const urls = await savePhotos(input, `checkin-${id}`);
    if (!urls.length) return fail("ບັນທຶກຮູບບໍ່ສຳເລັດ");

    const r = await query(
      `UPDATE odg_work_order
          SET checkin_at = now(), checkin_lat = $2, checkin_lng = $3,
              checkin_photo = $4, checkin_photos = $5::jsonb, checkin_note = $6,
              checkin_by = $7, status = 'in_progress'
        WHERE id = $1 RETURNING *`,
      [String(id), lat, lng, urls[0], JSON.stringify(urls), opts.note || null, actorName(user)],
    );
    invalidate("wo:");
    await notifyManagers("ຊ່າງ check-in ໜ້າງານ", `${actorName(user)} check-in ${wo.work_no || "ໃບງານ"}`, { workOrderId: String(id), type: "wo_checkin" });
    await notifyManagersInApp("work_order", String(id), "wo_checkin", `${actorName(user)} check-in ${wo.work_no || "ໃບງານ"}`, user.username, actorName(user));
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** On-completion check-out (work done → awaiting review): photo(s) + GPS. */
export async function checkOutWorkOrderAs(
  user: ActingUser,
  id: string,
  opts: { lat: number; lng: number; photoBase64?: string; photos?: string[]; note?: string; signatureBase64?: string },
): Promise<Ok | Fail> {
  try {
    const bad = assertV2Id(String(id));
    if (bad) return fail(bad);
    await ensureWorkOrderSchema();
    const wo = await loadWoRow(String(id));
    if (!wo) return fail("ບໍ່ພົບໃບງານ");
    if (!(await canWorkOnWo(user, wo))) return fail("ໃບງານນີ້ບໍ່ໄດ້ມອບໝາຍໃຫ້ທ່ານ");
    if (!wo.checkin_at) return fail("ກະລຸນາ check-in ກ່ອນ");
    if (wo.checkout_at) return fail("ໄດ້ check-out ໄປແລ້ວ");

    const lat = numOrNull(opts.lat);
    const lng = numOrNull(opts.lng);
    if (lat === null || lng === null) return fail("ບໍ່ພົບ location — ກະລຸນາເປີດ GPS");

    const input = (opts.photos && opts.photos.length ? opts.photos : opts.photoBase64 ? [opts.photoBase64] : []).filter(Boolean);
    if (!input.length) return fail("ກະລຸນາຖ່າຍຮູບຫຼັງເຮັດວຽກສຳເລັດ");
    const urls = await savePhotos(input, `checkout-${id}`);
    if (!urls.length) return fail("ບັນທຶກຮູບບໍ່ສຳເລັດ");

    let signatureUrl: string | null = null;
    if (opts.signatureBase64) {
      signatureUrl = await saveBase64File({ base64: opts.signatureBase64, fileName: `signature-${id}.png`, relativeDir: "static/uploads" });
    }

    const r = await query(
      `UPDATE odg_work_order
          SET checkout_at = now(), checkout_lat = $2, checkout_lng = $3,
              checkout_photo = $4, checkout_photos = $5::jsonb, checkout_note = $6,
              checkout_signature = $8, checkout_by = $7, status = 'awaiting_review'
        WHERE id = $1 RETURNING *`,
      [String(id), lat, lng, urls[0], JSON.stringify(urls), opts.note || null, actorName(user), signatureUrl],
    );
    invalidate("wo:");
    await notifyManagers("ຊ່າງ check-out — ລໍຖ້າກວດສອບ", `${actorName(user)} ສຳເລັດ ${wo.work_no || "ໃບງານ"} — ກະລຸນາກວດສອບ & ປິດງານ`, { workOrderId: String(id), type: "wo_checkout" });
    await notifyManagersInApp("work_order", String(id), "wo_checkout", `${actorName(user)} ສຳເລັດ ${wo.work_no || "ໃບງານ"} — ລໍຖ້າກວດສອບ`, user.username, actorName(user));
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Inspector / manager closes a checked-out work order (ລໍຖ້າກວດສອບ → ປິດງານແລ້ວ). */
export async function closeWorkOrderAs(
  user: ActingUser,
  id: string,
  opts: { note?: string } = {},
): Promise<Ok | Fail> {
  try {
    const bad = assertV2Id(String(id));
    if (bad) return fail(bad);
    if (!can(user, "work-orders", "approve")) return fail("ບໍ່ມີສິດປິດງານ (ສະເພາະຜູ້ກວດສອບ/ຜູ້ຈັດການ)");
    await ensureWorkOrderSchema();
    const wo = await loadWoRow(String(id));
    if (!wo) return fail("ບໍ່ພົບໃບງານ");
    if (!wo.checkout_at) return fail("ໃບງານຍັງບໍ່ໄດ້ check-out — ຍັງປິດບໍ່ໄດ້");
    if (wo.closed_at) return fail("ໃບງານປິດໄປແລ້ວ");

    const r = await query(
      `UPDATE odg_work_order
          SET closed_at = now(), closed_by = $2, close_note = $3, status = 'closed'
        WHERE id = $1 RETURNING *`,
      [String(id), actorName(user), opts.note || null],
    );
    invalidate("wo:");
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/* ── Checklist: mark a work-order task done/undone (stored in the tasks JSONB) ── */
export async function setTaskDoneAs(user: ActingUser, id: string, index: number, done: boolean): Promise<Ok | Fail> {
  try {
    const bad = assertV2Id(String(id));
    if (bad) return fail(bad);
    await ensureWorkOrderSchema();
    const wo = await loadWoRow(String(id));
    if (!wo) return fail("ບໍ່ພົບໃບງານ");
    if (!(await canWorkOnWo(user, wo))) return fail("ໃບງານນີ້ບໍ່ໄດ້ມອບໝາຍໃຫ້ທ່ານ");
    const tasks = Array.isArray(wo.tasks) ? wo.tasks : [];
    if (index < 0 || index >= tasks.length) return fail("ບໍ່ພົບໜ້າວຽກ");
    tasks[index] = { ...tasks[index], done: !!done };
    const r = await query(`UPDATE odg_work_order SET tasks = $2::jsonb WHERE id = $1 RETURNING *`, [String(id), JSON.stringify(tasks)]);
    invalidate("wo:");
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/* ── Material request (ໃບຂໍເບີກ) raised by the craftsman from the app ── */
export async function createMaterialRequestAs(
  user: ActingUser,
  id: string,
  items: Array<{ name?: string; unit?: string; qty?: number; item_code?: string; boq_qty?: number }>,
  note?: string,
  opts?: { usedByCode?: string; usedByName?: string },
): Promise<Ok | Fail> {
  try {
    await ensureWorkOrderSchema();
    const wo = await loadWoRow(String(id));
    if (!wo) return fail("ບໍ່ພົບໃບງານ");
    if (!(await canWorkOnWo(user, wo))) return fail("ໃບງານນີ້ບໍ່ໄດ້ມອບໝາຍໃຫ້ທ່ານ");
    // Once the craftsman has checked out (work done → awaiting review), no more
    // material requests — covers closed jobs too (close happens after check-out).
    if (wo.checkout_at) return fail("ໃບງານ check-out ແລ້ວ ບໍ່ສາມາດເບີກວັດສະດຸໄດ້");
    const clean = (Array.isArray(items) ? items : [])
      .map((m) => ({
        item_code: String(m?.item_code || "").trim(),
        name: String(m?.name || "").trim(),
        unit: String(m?.unit || "").trim(),
        qty: Number(m?.qty) || 0,
        boq_qty: Number(m?.boq_qty) || 0,
      }))
      .filter((m) => m.name && m.qty > 0);
    if (!clean.length) return fail("ກະລຸນາໃສ່ລາຍການວັດສະດຸ");
    const r = await query(
      `INSERT INTO odg_wo_material_request (work_order_id, project_id, requested_by, items, note, used_by_code, used_by_name, status)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,'pending') RETURNING *`,
      [
        String(id),
        wo.project_id ? String(wo.project_id) : null,
        actorName(user),
        JSON.stringify(clean),
        note || null,
        opts?.usedByCode || null,
        opts?.usedByName || null,
      ],
    );
    // Notify the back office (bell + push) that a craftsman requested materials.
    const summary = `${actorName(user)} ຂໍເບີກວັດສະດຸ ${clean.length} ລາຍການ`;
    await notifyManagersInApp("work_order", String(id), "material_request", summary, user.username, actorName(user));
    await notifyManagers("ມີຄຳຂໍເບີກວັດສະດຸໃໝ່", summary, { entity_type: "work_order", entity_id: String(id) });
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Manager/approver advances a material request: pending → approved → issued, or → rejected. */
export async function setMaterialRequestStatusAs(
  user: ActingUser,
  reqId: string,
  status: string,
  note?: string,
): Promise<Ok | Fail> {
  try {
    if (!can(user, "work-orders", "approve")) return fail("ບໍ່ມີສິດອະນຸມັດ/ເບີກວັດສະດຸ");
    const allowed = ["approved", "issued", "rejected"];
    if (!allowed.includes(status)) return fail("ສະຖານະບໍ່ຖືກຕ້ອງ");
    await ensureWorkOrderSchema();
    const cur = await query(`SELECT * FROM odg_wo_material_request WHERE id = $1 LIMIT 1`, [String(reqId)]);
    const req = cur.rows[0];
    if (!req) return fail("ບໍ່ພົບໃບຂໍເບີກ");
    // Forward-only flow: ຂໍເບີກ(pending) → ອະນຸມັດ(approved) → ເບີກແລ້ວ(issued).
    if (status === "issued" && req.status !== "approved") return fail("ຕ້ອງອະນຸມັດກ່ອນຈຶ່ງເບີກໄດ້");
    if (status === "approved" && req.status !== "pending") return fail("ໃບນີ້ດຳເນີນການໄປແລ້ວ");
    const r = await query(
      `UPDATE odg_wo_material_request
          SET status = $2, approver = $3, status_at = now(), status_note = COALESCE($4, status_note)
        WHERE id = $1 RETURNING *`,
      [String(reqId), status, actorName(user), note || null],
    );
    const label = status === "approved" ? "ອະນຸມັດແລ້ວ" : status === "issued" ? "ເບີກວັດສະດຸແລ້ວ" : "ຖືກປະຕິເສດ";
    await notifyCraftsman(
      req.requested_by,
      `ໃບຂໍເບີກວັດສະດຸ ${label}`,
      `${actorName(user)} ${label}`,
      { workOrderId: String(req.work_order_id), type: "material_status" },
    );
    if (req.work_order_id) {
      await notifyManagersInApp("work_order", String(req.work_order_id), `material_${status}`, `${actorName(user)} ${label} ໃບຂໍເບີກ`, user.username, actorName(user));
    }
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function listMaterialRequests(id: string): Promise<{ success: true; data: any[] } | Fail> {
  try {
    await ensureWorkOrderSchema();
    const r = await query(
      `SELECT id::text, work_order_id, project_id, requested_by, items, note, status,
              used_by_code, used_by_name, approver, status_at, status_note, created_at
         FROM odg_wo_material_request WHERE work_order_id = $1 ORDER BY created_at DESC`,
      [String(id)],
    );
    return { success: true, data: r.rows };
  } catch (e) {
    return fail((e as Error).message);
  }
}
