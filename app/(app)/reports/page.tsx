/**
 * Reports & analytics — SERVER component.
 *
 * The three stat datasets (project dashboard, revenue, sales) are fetched here
 * on the server during render and passed to the interactive client as props.
 * This removes the old client-side mount→useEffect→Promise.all waterfall: the
 * data is already in the first HTML/RSC payload.
 */
import { getProjectDashboardStats, getProjectRevenueStats } from "@/_actions/projects";
import { getSalesStatsAction } from "@/_actions/auth";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [d, r, s] = await Promise.all([
    getProjectDashboardStats(),
    getProjectRevenueStats(),
    getSalesStatsAction(),
  ]);

  const initialStats = (d as any)?.success ? d : null;
  const initialRevenue = (r as any)?.success ? r : null;
  const initialSales = (s as any)?.success ? s : null;

  return (
    <ReportsClient
      initialStats={initialStats}
      initialRevenue={initialRevenue}
      initialSales={initialSales}
    />
  );
}
