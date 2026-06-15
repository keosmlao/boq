/**
 * Schedule (ກຳນົດໜ້າວຽກ) — SERVER component.
 *
 * The per-project task groups are fetched here, on the server, by calling the
 * same action that /api/schedule wraps (getScheduleByProject) — no self-HTTP
 * round-trip — and handed to the interactive client as `initialRows`. This
 * removes the old client-side mount→fetch("/api/schedule")→action→DB waterfall:
 * the data is in the first render. The refresh button still re-pulls via
 * /api/schedule on demand.
 *
 * `force-dynamic` keeps the list fresh per request (and avoids a build-time DB
 * hit).
 */
import { getScheduleByProject } from "@/_actions/tasks-v2";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const res: any = await getScheduleByProject();
  const initialRows = res?.success ? res.data || [] : [];
  return <ScheduleClient initialRows={initialRows} />;
}
