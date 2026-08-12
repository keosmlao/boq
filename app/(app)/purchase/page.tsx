import PurchaseClient from "./PurchaseClient";
import { getBoqStock, getPurchaseLines } from "@/_actions/purchase";

export const dynamic = "force-dynamic";

/**
 * ຂໍຊື້ — the first page of each table is rendered on the server. Both tables
 * are paged server-side from here on, so the browser never holds the full set.
 */
export default async function PurchasePage() {
  const [demand, lines] = await Promise.all([
    getBoqStock({ page: 1, tab: "short", sort: "shortfall_qty", dir: "desc" }),
    getPurchaseLines({ page: 1 }),
  ]);
  return (
    <PurchaseClient
      initialDemand={demand.success ? demand.data : null}
      initialLines={lines.success ? lines.data : null}
    />
  );
}
