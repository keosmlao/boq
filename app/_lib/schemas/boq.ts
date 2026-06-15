/**
 * BOQ helpers. The v2 BOQ feature is backed by the ERP tables
 * (odg_projects_boq / odg_projects_boq_detail) — there is no separate v2 table.
 */

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
