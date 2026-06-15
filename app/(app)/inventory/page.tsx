/**
 * Inventory / stock browser — SERVER component.
 *
 * The initial (empty-search) inventory rows are fetched here, on the server,
 * during render and handed to the interactive client list as `initialRows`.
 * This removes the old client-side mount→useEffect→server-action→DB waterfall:
 * the data is already in the first HTML/RSC payload, so navigating to
 * /inventory no longer shows a second in-page spinner after the route JS loads.
 *
 * The client (InventoryClient) keeps its debounced search refetch — it skips
 * the seeded first render and refetches whenever the user types a search.
 *
 * `force-dynamic` keeps the list fresh per request (and avoids a build-time DB
 * hit).
 */
import { getInventory } from "@/_actions/lookups";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

const LIMIT = 100;

export default async function InventoryPage() {
  const res: any = await getInventory({ search: "", limit: LIMIT });
  const initialRows = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return <InventoryClient initialRows={initialRows} />;
}
