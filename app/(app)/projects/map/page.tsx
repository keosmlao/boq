/**
 * Projects map page — same data as the projects list, opened straight into
 * the map view. Reuses ProjectsClient so search / status filters still apply.
 */
import { getProjects } from "@/_actions/projects";
import ProjectsClient from "../ProjectsClient";

export const dynamic = "force-dynamic";

export default async function ProjectsMapPage() {
  const res: any = await getProjects({ summary: true });
  const initialRows = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return <ProjectsClient initialRows={initialRows} initialView="map" />;
}
