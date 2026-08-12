/**
 * ໂຄງການ list — SERVER component. Only the first page is rendered here; every
 * search / tab / sort / page change calls getProjectsPage() and returns one
 * page. The board / map / group-by-customer views ask for a large page, since
 * those genuinely need the whole set.
 */
import { getProjectsPage } from "@/_actions/projects";
import ProjectsClient from "./ProjectsClient";

export const dynamic = "force-dynamic";

export default async function ProjectsListPage() {
  const res = await getProjectsPage({ page: 1, sort: "project_name", dir: "asc" });
  return <ProjectsClient initial={res.success ? res.data : null} />;
}
