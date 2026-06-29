"use server";

/**
 * Cross-module "pending approval" inbox — gathers every document that is still
 * waiting for someone to approve it, so the sidebar can show one count and the
 * /approvals page can list them all in one place. Each source is independent
 * and tolerant: if one query fails (missing table/column) the rest still load.
 */
import { query } from "@/_lib/db";
import { ensureRequestSchema } from "@/_lib/schemas/request";
import { getSessionUser } from "@/_lib/server-auth";
import { can, isAdmin } from "@/_lib/permissions";

export type ApprovalItem = {
  type: "quotation" | "contract" | "boq" | "substitute" | "app_request";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export type ApprovalSummary = {
  total: number;
  quotations: ApprovalItem[];
  contracts: ApprovalItem[];
  boq: ApprovalItem[];
  substitutes: ApprovalItem[];
  appRequests: ApprovalItem[];
};

export async function getApprovalSummary(): Promise<{ success: true; data: ApprovalSummary } | { success: false; message: string }> {
  const data: ApprovalSummary = { total: 0, quotations: [], contracts: [], boq: [], substitutes: [], appRequests: [] };

  // Only surface the categories this user is actually allowed to act on.
  const u = await getSessionUser();
  const admin = isAdmin(u);
  const allow = {
    quotations: admin || can(u, "quotations", "approve"),
    contracts: admin || can(u, "contracts", "approve"),
    boq: admin || can(u, "boq", "approve") || can(u, "boq", "approve_next"),
    substitutes: admin || can(u, "requests", "approve_substitute"),
    appRequests: admin || can(u, "requests", "create") || can(u, "requests", "approve"),
  };

  // Quotations waiting for approval (status still the default "ລໍຖ້າອະນຸມັດ").
  if (allow.quotations) try {
    const r = await query(
      `SELECT id, quotation_no, project_name FROM odg_quotation WHERE status = 'ລໍຖ້າອະນຸມັດ' ORDER BY id DESC LIMIT 200`,
    );
    data.quotations = r.rows.map((x: any) => ({
      type: "quotation",
      id: String(x.id),
      title: x.quotation_no || `#${x.id}`,
      subtitle: x.project_name || undefined,
      href: `/quotations/${x.id}`,
    }));
  } catch (e) {
    console.error("getApprovalSummary quotations:", (e as Error).message);
  }

  // v2 contracts not yet sales-approved.
  if (allow.contracts) try {
    const r = await query(
      `SELECT id, contract_no, project_name FROM odg_contract WHERE COALESCE(sales_approved, false) = false ORDER BY id DESC LIMIT 200`,
    );
    data.contracts = r.rows.map((x: any) => ({
      type: "contract",
      id: String(x.id),
      title: x.contract_no || `#${x.id}`,
      subtitle: x.project_name || undefined,
      href: `/contracts/${x.id}`,
    }));
  } catch (e) {
    console.error("getApprovalSummary contracts:", (e as Error).message);
  }

  // BOQ documents still waiting (approve_status 0/null).
  if (allow.boq) try {
    const r = await query(
      `SELECT doc_no FROM odg_projects_boq WHERE COALESCE(approve_status, 0) = 0 ORDER BY doc_no DESC LIMIT 200`,
    );
    data.boq = r.rows.map((x: any) => ({
      type: "boq",
      id: String(x.doc_no),
      title: String(x.doc_no),
      href: `/boq/${encodeURIComponent(x.doc_no)}`,
    }));
  } catch (e) {
    console.error("getApprovalSummary boq:", (e as Error).message);
  }

  // Requests with item substitutions still awaiting approval.
  if (allow.substitutes) try {
    await ensureRequestSchema();
    const r = await query(
      `SELECT id, request_no, project_name, items FROM odg_request
        WHERE COALESCE(status, '') <> 'rejected' AND COALESCE(substitute_approved, false) = false
        ORDER BY id DESC LIMIT 300`,
    );
    data.substitutes = r.rows
      .filter((x: any) =>
        Array.isArray(x.items) &&
        x.items.some((it: any) => {
          const boq = String(it?.boq_item_code || "").trim();
          return boq && boq !== String(it?.item_code || "").trim();
        }),
      )
      .map((x: any) => ({
        type: "substitute",
        id: String(x.id),
        title: x.request_no || `#${x.id}`,
        subtitle: x.project_name || undefined,
        href: `/requests/${x.id}`,
      }));
  } catch (e) {
    console.error("getApprovalSummary substitutes:", (e as Error).message);
  }

  // App requests the head craftsman has APPROVED — ready for admin to pull into a
  // real requisition. (pending ones are still waiting for the head craftsman.)
  if (allow.appRequests) try {
    const r = await query(
      `SELECT m.id, m.items,
              (SELECT project_name FROM odg_projects p WHERE p.id::text = m.project_id OR p.sml_code = m.project_id LIMIT 1) AS project_name
         FROM odg_wo_material_request m
        WHERE m.status = 'approved'
        ORDER BY m.created_at DESC LIMIT 200`,
    );
    data.appRequests = r.rows.map((x: any) => ({
      type: "app_request" as const,
      id: `app-${x.id}`,
      title: `APP-${x.id}`,
      subtitle: x.project_name || undefined,
      href: `/requests/app-${x.id}`,
    }));
  } catch (e) {
    console.error("getApprovalSummary appRequests:", (e as Error).message);
  }

  data.total =
    data.quotations.length + data.contracts.length + data.boq.length + data.substitutes.length + data.appRequests.length;
  return { success: true, data };
}

/** Lightweight count only — used by the sidebar badge. */
export async function getApprovalCount(): Promise<number> {
  const res = await getApprovalSummary();
  return res.success ? res.data.total : 0;
}
