/**
 * v2 customers list — SERVER component.
 *
 * Only the FIRST PAGE is rendered here; searching, filtering, sorting and
 * paging all call getCustomersPage() and return one page. The customer +
 * project roll-up behind it is cached server-side, so paging does not re-query
 * the ERP each time.
 *
 * Each project's documents (quotations, contracts, BOQ, tasks, work orders,
 * requests) are still lazy-loaded on expand inside the client component.
 *
 * `force-dynamic` keeps the list fresh per request (and avoids a build-time DB
 * hit).
 */
import { getCustomersPage } from "@/_actions/customers";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const res = await getCustomersPage({ page: 1, sort: "projects", dir: "desc" });
  return <CustomersClient initial={res.success ? (res.data as any) : null} />;
}
