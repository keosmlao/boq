/**
 * v2 customers list — SERVER component.
 *
 * The initial customers + their summary projects are fetched here, on the
 * server, during render and handed to the interactive client tree as
 * `initialCustomers` / `initialProjects`. This removes the old client-side
 * mount→useEffect→server-action→DB waterfall: the data is already in the first
 * HTML/RSC payload, so navigating to /customers no longer shows a second
 * in-page spinner after the route JS loads.
 *
 * Each project's documents (quotations, contracts, BOQ, tasks, work orders,
 * requests) are still lazy-loaded on expand inside the client component.
 *
 * `force-dynamic` keeps the list fresh per request (and avoids a build-time DB
 * hit).
 */
import { getCustomers } from "@/_actions/customers";
import { getProjects } from "@/_actions/projects";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

const arr = (res: any): any[] => (res?.success ? res.data || [] : Array.isArray(res) ? res : []);

export default async function CustomersPage() {
  const [cRes, pRes]: any = await Promise.all([getCustomers(), getProjects({ summary: true })]);
  const initialCustomers = cRes?.success ? cRes.data || [] : [];
  const initialProjects = arr(pRes);
  return <CustomersClient initialCustomers={initialCustomers} initialProjects={initialProjects} />;
}
