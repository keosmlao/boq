/**
 * Dashboard landing "/" — SERVER component.
 *
 * The three datasets (projects summary, dashboard stats, revenue stats) are
 * fetched here on the server during render and handed to the interactive client
 * as props. This removes the old client-side mount→useEffect→Promise.all
 * waterfall: the data is already in the first HTML/RSC payload.
 */
import { getProjects, getProjectDashboardStats, getProjectRevenueStats } from "@/_actions/projects";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projectsResult, dashboardResult, revenueResult] = await Promise.all([
    getProjects({ summary: true }),
    getProjectDashboardStats(),
    getProjectRevenueStats(),
  ]);

  const projectResponse: any = projectsResult;
  const initialProjects = projectResponse?.success
    ? projectResponse.data || []
    : Array.isArray(projectResponse)
    ? projectResponse
    : [];
  const initialStats = (dashboardResult as any)?.success ? dashboardResult : null;
  const initialRevenue = (revenueResult as any)?.success ? revenueResult : null;

  return (
    <DashboardClient
      initialProjects={initialProjects}
      initialStats={initialStats}
      initialRevenue={initialRevenue}
    />
  );
}
