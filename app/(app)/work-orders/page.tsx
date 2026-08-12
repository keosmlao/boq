/**
 * ໃບງານ list — SERVER component. Only the first page is rendered here; every
 * search / tab / sort / page change calls getWorkOrdersPage() and returns one
 * page, so the browser never holds every work order ever raised.
 */
import { getWorkOrdersPage } from "@/_actions/workorder";
import WorkOrdersClient from "./WorkOrdersClient";
import { resolveQueuePage } from "@/_lib/queue-tab";

export const dynamic = "force-dynamic";

export default async function WorkOrdersListPage() {
  // The list opens on the tab that belongs to this user, unless that queue is
  // already clear — then it shows everything (see resolveQueuePage).
  const { tab, data } = await resolveQueuePage("work-orders", (queueTab) =>
    getWorkOrdersPage({ ...{ page: 1, sort: "work_date", dir: "desc" }, tab: queueTab }),
  );
  return <WorkOrdersClient initial={data} initialTab={tab} />;
}
