/**
 * Requests (ຂໍເບີກ) list — SERVER component.
 *
 * Only the FIRST PAGE is rendered here; every later search / tab / sort / page
 * change calls getRequestsPage() and gets one page back. The merged row set
 * (v2 + legacy ERP + mobile app) is cached server-side for a minute, so paging
 * through it does not re-query the ERP each time.
 *
 * `force-dynamic` keeps the list fresh per request (and avoids a build-time DB
 * hit).
 */
import { getRequestsPage } from "@/_actions/request-v2";
import RequestsClient from "./RequestsClient";
import { resolveQueuePage } from "@/_lib/queue-tab";

export const dynamic = "force-dynamic";

export default async function RequestsListPage() {
  // The list opens on the tab that belongs to this user, unless that queue is
  // already clear — then it shows everything (see resolveQueuePage).
  const { tab, data } = await resolveQueuePage("requests", (queueTab) =>
    getRequestsPage({ ...{ page: 1, sort: "created_at", dir: "desc" }, tab: queueTab }),
  );
  return <RequestsClient initial={data} initialTab={tab} />;
}
