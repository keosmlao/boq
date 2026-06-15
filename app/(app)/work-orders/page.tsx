/**
 * Work-orders list — SERVER component.
 *
 * The rows are fetched here, on the server, during render and handed to the
 * interactive client list as `initialRows`. This removes the old client-side
 * mount→useEffect→server-action waterfall: the data is already in the first
 * HTML/RSC payload, so navigating to /work-orders no longer shows a second
 * in-page spinner after the route JS loads. Manual refresh still re-pulls.
 *
 * `force-dynamic` keeps the list fresh per request (and avoids a build-time DB
 * hit).
 */
import { getWorkOrders } from "@/_actions/workorder";
import WorkOrdersClient from "./WorkOrdersClient";

export const dynamic = "force-dynamic";

export default async function WorkOrdersListPage() {
  const res: any = await getWorkOrders({});
  const initialRows = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return <WorkOrdersClient initialRows={initialRows} />;
}
