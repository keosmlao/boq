"use server";

/**
 * Craftsman self-service check-in on the WEB (ໜ້າເຊັກອິນຊ່າງ). Mirrors the
 * mobile flow (accept → check-in → check-out, each with photo + GPS) but is
 * driven by the web cookie session and authorised by IDENTITY
 * (technician_code / assigned_username === username), NOT the permission matrix,
 * because craftsmen hold an empty permission set on the web.
 *
 * This is the EXPLICIT, visible attendance channel. It deliberately does NOT
 * read or expose the covert continuous GPS feed (odg_craftsman_location /
 * odg_craftsman_presence) — that stays manager-only.
 */
import { getSessionUser, type SessionUser } from "@/_lib/server-auth";
import { isManager } from "@/_lib/permissions";
import { getWorkOrders } from "@/_actions/workorder";
import {
  leadCodesForHelper,
  respondWorkOrderAs,
  checkInWorkOrderAs,
  checkOutWorkOrderAs,
} from "@/_lib/workorder-core";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });

const acting = (u: SessionUser) => ({ username: u.username, name: u.name, role: u.role, permissions: u.permissions });

/** Rank so the row the craftsman can act on right now floats to the top. */
function actionRank(w: any): number {
  if (w.approval_status !== "approved") return 5; // waiting for manager
  if (w.checkout_at) return 4; // done
  if (w.checkin_at) return 0; // in progress → can check out
  if (w.accept_status === "accepted") return 1; // ready to check in
  if (w.accept_status === "rejected") return 3;
  return 2; // approved, awaiting accept
}

/** The logged-in craftsman's own work orders (managers see all). */
export async function getMyWorkOrders(): Promise<{ success: true; data: any[]; me: { username: string; name: string; manager: boolean } } | Fail> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    const res = await getWorkOrders({});
    if (res.success === false) return fail(res.message);

    let data = res.data as any[];
    const manager = isManager(user);
    if (!manager) {
      const me = String(user.username || "");
      const leadCodes = new Set(await leadCodesForHelper(me));
      data = data.filter(
        (w) =>
          String(w.technician_code || "") === me ||
          String(w.assigned_username || "") === me ||
          leadCodes.has(String(w.technician_code || "")),
      );
    }
    data = [...data].sort((a, b) => actionRank(a) - actionRank(b));
    return { success: true, data, me: { username: user.username, name: user.name, manager } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function acceptMyWorkOrder(id: string): Promise<{ success: true } | Fail> {
  const user = await getSessionUser();
  if (!user) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
  const res = await respondWorkOrderAs(acting(user), String(id), { accept: true });
  return res.success ? { success: true } : res;
}

export async function checkInMyWorkOrder(
  id: string,
  opts: { lat: number; lng: number; photoBase64?: string; note?: string },
): Promise<{ success: true } | Fail> {
  const user = await getSessionUser();
  if (!user) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
  const res = await checkInWorkOrderAs(acting(user), String(id), opts);
  return res.success ? { success: true } : res;
}

export async function checkOutMyWorkOrder(
  id: string,
  opts: { lat: number; lng: number; photoBase64?: string; note?: string },
): Promise<{ success: true } | Fail> {
  const user = await getSessionUser();
  if (!user) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
  const res = await checkOutWorkOrderAs(acting(user), String(id), opts);
  return res.success ? { success: true } : res;
}
