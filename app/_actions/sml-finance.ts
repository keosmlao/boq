"use server";

/**
 * Read-only pull of a project's financial footprint from the SML/ERP database.
 * A project links to SML via odg_projects.sml_code, which equals the ERP
 * project_code (format "NN-xxxx", e.g. "01-2830"). Projects whose sml_code is
 * empty or a non-ERP placeholder (e.g. "PJ2026...") are treated as "not linked".
 *
 * Sources (all keyed by project_code):
 *  - Sales bills  → ic_trans WHERE trans_type = 2   (sale documents)
 *  - Payments     → ap_ar_trans                     (AR receipts / debt movements)
 *  - Expenses     → profitloss                      (per-project GL P&L by account)
 */

import { query } from "@/_lib/db";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });

const ERP_CODE_RE = /^\d{1,3}-\d+/; // matches "01-2830" and sub-codes like "01-3103-2"

// Goods sales bill = ic_trans trans_flag 44 (confirmed by the business).
const SALE_BILL_FLAGS = [44];

export type SmlBill = {
  doc_no: string;
  doc_date: string | null;
  cust_code: string | null;
  total_amount: number;
  balance_amount: number;
  doc_kind: string;
};
export type SmlPayment = {
  doc_no: string;
  doc_date: string | null;
  amount: number;
  total_pay_money: number;
  total_debt_balance: number;
  payment_method: string | null;
};
export type SmlExpense = {
  account_code: string;
  account_name: string;
  group_name: string | null;
  debit: number;
  credit: number;
};
export type SmlFinance = {
  success: true;
  linked: boolean;
  projectCode: string | null;
  bills: SmlBill[];
  payments: SmlPayment[];
  expenses: SmlExpense[];
  totals: { billed: number; outstanding: number; paid: number; expense: number };
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const d = (v: unknown) => (v == null ? null : String(v));

const BILL_KIND: Record<number, string> = { 44: "ໃບບິນຂາຍສິນຄ້າ" };

export async function getProjectSmlFinance(projectId: string): Promise<SmlFinance | Fail> {
  try {
    const pid = String(projectId || "").trim();
    if (!pid) return fail("project id is required");

    const pr = await query(`SELECT sml_code FROM odg_projects WHERE id = $1 LIMIT 1`, [pid]);
    const smlCode = String(pr.rows?.[0]?.sml_code ?? "").trim();

    const empty: SmlFinance = {
      success: true,
      linked: false,
      projectCode: smlCode || null,
      bills: [],
      payments: [],
      expenses: [],
      totals: { billed: 0, outstanding: 0, paid: 0, expense: 0 },
    };
    if (!smlCode || !ERP_CODE_RE.test(smlCode)) return empty;

    const [billsR, paysR, expR] = await Promise.all([
      query(
        `SELECT doc_no, doc_date, trans_type, trans_flag, cust_code,
                COALESCE(total_amount, 0)::numeric AS total_amount,
                COALESCE(balance_amount, 0)::numeric AS balance_amount
           FROM ic_trans
          WHERE project_code = $1 AND trans_flag = ANY($2::int[]) AND COALESCE(is_cancel, 0) = 0
          ORDER BY doc_date DESC NULLS LAST, doc_no DESC
          LIMIT 300`,
        [smlCode, SALE_BILL_FLAGS],
      ),
      query(
        `SELECT doc_no, doc_date,
                COALESCE(amount, 0)::numeric AS amount,
                COALESCE(total_pay_money, 0)::numeric AS total_pay_money,
                COALESCE(total_debt_balance, 0)::numeric AS total_debt_balance,
                payment_method
           FROM ap_ar_trans
          WHERE project_code = $1 AND COALESCE(is_cancel, 0) = 0
          ORDER BY doc_date DESC NULLS LAST, doc_no DESC
          LIMIT 300`,
        [smlCode],
      ),
      query(
        `SELECT account_code, account_name, MAX(l1_name) AS group_name,
                SUM(COALESCE(debit, 0))::numeric  AS debit,
                SUM(COALESCE(credit, 0))::numeric AS credit
           FROM profitloss
          WHERE project_code = $1
          GROUP BY account_code, account_name
          ORDER BY SUM(COALESCE(debit, 0)) DESC NULLS LAST
          LIMIT 200`,
        [smlCode],
      ),
    ]);

    const bills: SmlBill[] = billsR.rows.map((r: any) => ({
      doc_no: String(r.doc_no ?? ""),
      doc_date: d(r.doc_date),
      cust_code: d(r.cust_code),
      total_amount: n(r.total_amount),
      balance_amount: n(r.balance_amount),
      doc_kind: BILL_KIND[Number(r.trans_flag)] ?? `ເອກະສານຂາຍ (${r.trans_flag})`,
    }));
    const payments: SmlPayment[] = paysR.rows.map((r: any) => ({
      doc_no: String(r.doc_no ?? ""),
      doc_date: d(r.doc_date),
      amount: n(r.amount),
      total_pay_money: n(r.total_pay_money),
      total_debt_balance: n(r.total_debt_balance),
      payment_method: d(r.payment_method),
    }));
    // Expenses = cost/expense accounts (codes starting with 5). Revenue (4xxx)
    // is excluded from the expense list but still useful for billed totals.
    const expenses: SmlExpense[] = expR.rows
      .map((r: any) => ({
        account_code: String(r.account_code ?? ""),
        account_name: String(r.account_name ?? ""),
        group_name: d(r.group_name),
        debit: n(r.debit),
        credit: n(r.credit),
      }))
      .filter((e) => e.account_code.startsWith("5"));

    const totals = {
      billed: bills.reduce((s, b) => s + b.total_amount, 0),
      outstanding: bills.reduce((s, b) => s + b.balance_amount, 0),
      paid: payments.reduce((s, p) => s + p.total_pay_money, 0),
      expense: expenses.reduce((s, e) => s + (e.debit - e.credit), 0),
    };

    return { success: true, linked: true, projectCode: smlCode, bills, payments, expenses, totals };
  } catch (e) {
    return fail((e as Error).message);
  }
}
