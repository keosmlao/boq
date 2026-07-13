"use server";

/**
 * Web entrypoint for the work-order rejection reset (ສົ່ງກັບໄປລໍອະນຸມັດໃໝ່).
 * Thin cookie-session wrapper over @/_lib/workorder-core — same shape as the
 * other lifecycle wrappers in ./workorder (approve / respond / check-in / …).
 * Lives in its own module so the core rule stays the single source of truth.
 */
import { requireUser } from "@/_lib/server-auth";
import { resetWorkOrderRejectionAs } from "@/_lib/workorder-core";

type Fail = { success: false; message: string };
function fail(message: string): Fail {
  return { success: false, message };
}

export async function resetWorkOrderRejection(id: string, opts: { note?: string } = {}) {
  try {
    const user = await requireUser();
    return await resetWorkOrderRejectionAs(user, id, opts);
  } catch (e) {
    return fail((e as Error).message);
  }
}
