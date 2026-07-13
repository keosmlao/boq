"use server";

/**
 * Sidebar badges — one small count per menu item ("what still needs me here?").
 * Each source is independent and tolerant: a missing table/column zeroes that
 * one badge instead of blanking the whole sidebar.
 */
import { query } from "@/_lib/db";

export type NavCounts = {
  workOrders: number; // ໃບງານທີ່ຍັງບໍ່ປິດ
  requests: number; // ໃບຂໍເບີກທີ່ຍັງບໍ່ອອກເອກະສານ
  quotations: number; // ໃບສະເໜີລາຄາທີ່ຍັງລໍອະນຸມັດ
  contracts: number; // ສັນຍາທີ່ຍັງລໍອະນຸມັດ
  projects: number; // ໂຄງການທີ່ຍັງດຳເນີນຢູ່
};

const countOf = async (sql: string): Promise<number> => {
  try {
    const res = await query(sql);
    return Number(res.rows?.[0]?.n) || 0;
  } catch {
    return 0;
  }
};

export async function getNavCounts(): Promise<NavCounts> {
  const [v2WorkOrders, erpWorkOrders, requests, quotations, contracts, projects] = await Promise.all([
    // The ໃບງານ list merges v2 (odg_work_order) + legacy ERP (odg_work_orders), so the badge sums both.
    countOf(`SELECT count(*) AS n FROM odg_work_order WHERE coalesce(status, '') NOT IN ('closed', 'ປິດງານແລ້ວ', 'rejected', 'ບໍ່ອະນຸມັດ')`),
    countOf(`SELECT count(*) AS n FROM odg_work_orders WHERE coalesce(status, '') NOT IN ('closed', 'Closed', 'ປິດງານແລ້ວ', 'rejected', 'ບໍ່ອະນຸມັດ')`),
    countOf(`SELECT count(*) AS n FROM odg_requests WHERE coalesce(doc_success, 0) = 0`),
    countOf(`SELECT count(*) AS n FROM odg_quotation WHERE coalesce(status, '') NOT IN ('ອະນຸມັດແລ້ວ', 'approved', 'ປະຕິເສດ', 'rejected')`),
    // Contracts carry no pending status — they are done once both sign-offs are in.
    countOf(`SELECT count(*) AS n FROM odg_contract WHERE coalesce(sales_approved, false) = false OR coalesce(accounting_approved, false) = false`),
    // odg_projects.status is 0 while the project is still running.
    countOf(`SELECT count(*) AS n FROM odg_projects WHERE coalesce(status, 0) = 0`),
  ]);
  return { workOrders: v2WorkOrders + erpWorkOrders, requests, quotations, contracts, projects };
}
