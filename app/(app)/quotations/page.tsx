/**
 * ໃບສະເໜີລາຄາ list — SERVER component. Only the first page is rendered here;
 * every search / tab / sort / page change calls getQuotationsPage() and returns
 * one page, so the browser never holds the whole list.
 */
import { getQuotationsPage } from "@/_actions/quotations";
import QuotationsClient from "./QuotationsClient";
import { resolveQueuePage } from "@/_lib/queue-tab";

export const dynamic = "force-dynamic";

export default async function QuotationsListPage() {
  // The list opens on the tab that belongs to this user, unless that queue is
  // already clear — then it shows everything (see resolveQueuePage).
  const { tab, data } = await resolveQueuePage("quotations", (queueTab) =>
    getQuotationsPage({ ...{ page: 1, sort: "quotation_date", dir: "desc" }, tab: queueTab }),
  );
  return <QuotationsClient initial={data} initialTab={tab} />;
}
