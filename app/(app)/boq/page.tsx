/**
 * BOQ list — SERVER component. Only the first page is rendered here; every
 * search / tab / sort / page change calls getBoqsPage() and returns one page,
 * so the browser never holds the whole BOQ book.
 */
import { getBoqsPage } from "@/_actions/boq-v2";
import BoqClient from "./BoqClient";
import { resolveQueuePage } from "@/_lib/queue-tab";

export const dynamic = "force-dynamic";

export default async function BoqListPage() {
  // The list opens on the tab that belongs to this user, unless that queue is
  // already clear — then it shows everything (see resolveQueuePage).
  const { tab, data } = await resolveQueuePage("boq", (queueTab) =>
    getBoqsPage({ ...{ page: 1, sort: "created_at", dir: "desc" }, tab: queueTab }),
  );
  return <BoqClient initial={data} initialTab={tab} />;
}
