/**
 * v2 projects list — SERVER component.
 *
 * The project rows are fetched here, on the server, during render and handed
 * to the interactive client table as `initialRows`. This removes the old
 * client-side mount→useEffect→server-action→DB waterfall: the data is already
 * in the first HTML/RSC payload, so navigating to /projects no longer shows a
 * second in-page spinner after the route JS loads.
 *
 * `force-dynamic` keeps the list fresh per request (and avoids a build-time DB
 * hit). The 10s in-memory cache in getProjects() still de-dupes rapid reloads.
 */
import { getProjects } from "@/_actions/projects";
import ProjectsClient from "./ProjectsClient";

export const dynamic = "force-dynamic";

export default async function V2ProjectsListPage() {
  const res: any = await getProjects({ summary: true });
  const initialRows = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return <ProjectsClient initialRows={initialRows} />;
}
