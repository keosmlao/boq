/**
 * ສະຕັອກຕາມ BOQ — SERVER component.
 *
 * The list is driven by the BOQ of the projects that are still open, NOT by the
 * ERP product catalogue: the only stock question this office has is "do we hold
 * enough of what the live jobs still need". Search, tabs, sorting and paging all
 * happen inside getBoqStock() on the server, so one page load carries one page
 * of rows.
 */
import { getBoqStock } from "@/_actions/purchase";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const res = await getBoqStock({ page: 1, tab: "all", sort: "shortfall_qty", dir: "desc" });
  return <InventoryClient initial={res.success ? res.data : null} />;
}
