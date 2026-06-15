/**
 * BOQ list — SERVER component.
 *
 * The BOQ rows are fetched here, on the server, by calling the same action that
 * /api/boqs wraps (getAllBoqsForList) — no self-HTTP round-trip — and handed to
 * the interactive client as `initialRows`. This removes the old client-side
 * mount→fetch("/api/boqs")→action→DB waterfall: the data is in the first
 * render. The refresh button in CrossList still re-pulls via /api/boqs.
 *
 * `force-dynamic` keeps the list fresh per request (and avoids a build-time DB
 * hit).
 */
import { getAllBoqsForList } from "@/_actions/boq-v2";
import BoqClient from "./BoqClient";

export const dynamic = "force-dynamic";

export default async function BoqListPage() {
  const res: any = await getAllBoqsForList();
  const initialRows = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return <BoqClient initialRows={initialRows} />;
}
