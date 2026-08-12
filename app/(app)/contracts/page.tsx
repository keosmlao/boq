/**
 * ສັນຍາ list — SERVER component. Only the first page is rendered here; every
 * search / tab / sort / page change calls getContractsPage() and returns one
 * page, so the browser never holds the whole list.
 */
import { getContractsPage } from "@/_actions/contracts";
import ContractsClient from "./ContractsClient";
import { resolveQueuePage } from "@/_lib/queue-tab";

export const dynamic = "force-dynamic";

export default async function ContractsListPage() {
  // The list opens on the tab that belongs to this user, unless that queue is
  // already clear — then it shows everything (see resolveQueuePage).
  const { tab, data } = await resolveQueuePage("contracts", (queueTab) =>
    getContractsPage({ ...{ page: 1, sort: "created_at", dir: "desc" }, tab: queueTab }),
  );
  return <ContractsClient initial={data} initialTab={tab} />;
}
