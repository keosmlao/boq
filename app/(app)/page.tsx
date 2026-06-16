/**
 * Dashboard landing "/" — SERVER component.
 *
 * The three datasets (projects summary, dashboard stats, revenue stats) are
 * fetched here on the server during render and handed to the interactive client
 * as props. This removes the old client-side mount→useEffect→Promise.all
 * waterfall: the data is already in the first HTML/RSC payload.
 */
import { getProjects, getProjectDashboardStats, getProjectRevenueStats } from "@/_actions/projects";
import { getTeamAvailabilitySummary } from "@/_actions/team-availability";
import { getInstallTrackingSummary } from "@/_actions/install-tracking";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projectsResult, dashboardResult, revenueResult, teamsResult, installResult] = await Promise.all([
    getProjects({ summary: true }),
    getProjectDashboardStats(),
    getProjectRevenueStats(),
    getTeamAvailabilitySummary(),
    getInstallTrackingSummary(),
  ]);

  const projectResponse: any = projectsResult;
  const initialProjects = projectResponse?.success
    ? projectResponse.data || []
    : Array.isArray(projectResponse)
    ? projectResponse
    : [];
  const initialStats = (dashboardResult as any)?.success ? dashboardResult : null;
  const initialRevenue = (revenueResult as any)?.success ? revenueResult : null;
  const initialTeams = (teamsResult as any)?.success ? (teamsResult as any).data : null;
  const initialInstall = (installResult as any)?.success ? (installResult as any).data : null;

  return (
    <DashboardClient
      initialProjects={initialProjects}
      initialStats={initialStats}
      initialRevenue={initialRevenue}
      initialTeams={initialTeams}
      initialInstall={initialInstall}
    />
  );
}
