import { getSessionUser } from "@/_lib/server-auth";
import { can, isAdmin } from "@/_lib/permissions";

/**
 * Which tab a work queue should open on — "what needs ME", not "everything".
 *
 * A list is a queue, and whose queue it is depends on what the person is
 * allowed to do: the ຫົວໜ້າຊ່າງ opens ຂໍເບີກ on the requests waiting for their
 * approval, the back office opens it on the ones waiting to be pulled, and a
 * viewer with neither right just sees the whole list.
 *
 * Resolved on the SERVER while the first page is being built, so the list lands
 * on the right tab without a second round trip or a flash of the wrong rows.
 */
/**
 * The first page of a queue, opened on the tab that belongs to this user — but
 * falling back to the whole list when their queue happens to be empty. Landing
 * on an empty tab reads as "the system is broken", not "you are up to date".
 */
export async function resolveQueuePage<T>(
  moduleKey: string,
  load: (tab: string) => Promise<{ success: true; data: { rows: T[]; total: number } } | { success: false; message: string }>,
): Promise<{ tab: string; data: any }> {
  const preferred = await defaultQueueTab(moduleKey);
  const first = await load(preferred);
  if (preferred === "all" || !first.success) return { tab: preferred, data: first.success ? first.data : null };
  if (first.data.total > 0) return { tab: preferred, data: first.data };

  const all = await load("all");
  return { tab: "all", data: all.success ? all.data : first.data };
}

export async function defaultQueueTab(moduleKey: string): Promise<string> {
  const user = await getSessionUser().catch(() => null);
  if (!user) return "all";
  const u = { role: user.role, permissions: user.permissions } as any;
  const may = (action: string) => isAdmin(u) || can(u, moduleKey, action as any);

  switch (moduleKey) {
    case "requests":
      // Approvers first: their queue is the one that blocks everyone else.
      if (may("approve")) return "awaiting_head";
      if (may("create")) return "awaiting_pull";
      return "all";
    case "work-orders":
      return may("approve") ? "awaiting_review" : "all";
    case "quotations":
      return may("approve") ? "ລໍຖ້າອະນຸມັດ" : "all";
    case "contracts":
      return may("approve") ? "awaiting_sales" : "all";
    case "boq":
      return may("approve") ? "pending" : "all";
    default:
      return "all";
  }
}
