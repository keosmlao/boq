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
  const r = await query(`SELECT * FROM odg_work_order WHERE id = $1 LIMIT 1`, [id]);
  return r.rows[0] || null;
}

/** May this user act on this work order as the assigned craftsman? */
function canActAsCraftsman(user: ActingUser, wo: any): boolean {
  if (isManager(user)) return true;
  const assigned = wo?.assigned_username ? String(wo.assigned_username) : "";
  if (!assigned) return true; // no specific assignee → any holder may act
  return assigned === user.username;
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
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** On-site check-in BEFORE starting work: requires a photo and GPS location. */
export async function checkInWorkOrderAs(
  user: ActingUser,
  id: string,
  opts: { lat: number; lng: number; photoBase64: string; photoName?: string },
): Promise<Ok | Fail> {
  try {
    const bad = assertV2Id(String(id));
    if (bad) return fail(bad);
    await ensureWorkOrderSchema();
    const wo = await loadWoRow(String(id));
    if (!wo) return fail("ບໍ່ພົບໃບງານ");
    if (!canActAsCraftsman(user, wo)) return fail("ໃບງານນີ້ບໍ່ໄດ້ມອບໝາຍໃຫ້ທ່ານ");
    if (wo.accept_status !== "accepted") return fail("ກະລຸນາກົດຮັບງານກ່ອນ");
    if (wo.checkin_at) return fail("ໄດ້ check-in ໄປແລ້ວ");

    const lat = numOrNull(opts.lat);
    const lng = numOrNull(opts.lng);
    if (lat === null || lng === null) return fail("ບໍ່ພົບ location — ກະລຸນາເປີດ GPS");
    if (!opts.photoBase64) return fail("ກະລຸນາຖ່າຍຮູບກ່ອນເລີ່ມວຽກ");

    const photoUrl = await saveBase64File({
      base64: opts.photoBase64,
      fileName: opts.photoName || `checkin-${id}.jpg`,
      relativeDir: "static/uploads",
    });
    if (!photoUrl) return fail("ບັນທຶກຮູບບໍ່ສຳເລັດ");

    const r = await query(
      `UPDATE odg_work_order
          SET checkin_at = now(), checkin_lat = $2, checkin_lng = $3,
              checkin_photo = $4, checkin_by = $5, status = 'in_progress'
        WHERE id = $1 RETURNING *`,
      [String(id), lat, lng, photoUrl, actorName(user)],
    );
    invalidate("wo:");
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** On-completion check-out (closes the job): requires a photo and GPS location. */
export async function checkOutWorkOrderAs(
  user: ActingUser,
  id: string,
  opts: { lat: number; lng: number; photoBase64: string; photoName?: string },
): Promise<Ok | Fail> {
  try {
    const bad = assertV2Id(String(id));
    if (bad) return fail(bad);
    await ensureWorkOrderSchema();
    const wo = await loadWoRow(String(id));
    if (!wo) return fail("ບໍ່ພົບໃບງານ");
    if (!canActAsCraftsman(user, wo)) return fail("ໃບງານນີ້ບໍ່ໄດ້ມອບໝາຍໃຫ້ທ່ານ");
    if (!wo.checkin_at) return fail("ກະລຸນາ check-in ກ່ອນ");
    if (wo.checkout_at) return fail("ໄດ້ check-out ໄປແລ້ວ");

    const lat = numOrNull(opts.lat);
    const lng = numOrNull(opts.lng);
    if (lat === null || lng === null) return fail("ບໍ່ພົບ location — ກະລຸນາເປີດ GPS");
    if (!opts.photoBase64) return fail("ກະລຸນາຖ່າຍຮູບຫຼັງເຮັດວຽກສຳເລັດ");

    const photoUrl = await saveBase64File({
      base64: opts.photoBase64,
      fileName: opts.photoName || `checkout-${id}.jpg`,
      relativeDir: "static/uploads",
    });
    if (!photoUrl) return fail("ບັນທຶກຮູບບໍ່ສຳເລັດ");

    const r = await query(
      `UPDATE odg_work_order
          SET checkout_at = now(), checkout_lat = $2, checkout_lng = $3,
              checkout_photo = $4, checkout_by = $5, status = 'done'
        WHERE id = $1 RETURNING *`,
      [String(id), lat, lng, photoUrl, actorName(user)],
    );
    invalidate("wo:");
    return { success: true, data: r.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}
