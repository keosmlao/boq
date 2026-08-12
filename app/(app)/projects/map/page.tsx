/**
 * Projects map page — same data as the projects list, opened straight into the
 * map view. The map needs every pin, so it asks for a large page up front;
 * search / status filters still apply and are resolved on the server.
 */
import { getProjectsPage } from "@/_actions/projects";
import ProjectsClient from "../ProjectsClient";

export const dynamic = "force-dynamic";

export default async function ProjectsMapPage() {
  const res = await getProjectsPage({ page: 1, perPage: 200, sort: "project_name", dir: "asc" });
  return <ProjectsClient initial={res.success ? res.data : null} initialView="map" />;
}
