"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getProjectDashboardStats, getProjectRevenueStats } from "@/_actions/projects";
import { getSalesStatsAction } from "@/_actions/auth";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import {
  Users as FiUsers,
  FileText as FiFileText,
  TrendingUp as FiTrendingUp,
  Calendar as FiCalendar,
  DollarSign as FiDollarSign,
  MapPin as FiMapPin,
  CirclePlus as FiPlusCircle,
  Eye as FiEye,
  Clock as FiClock,
  Target as FiTarget,
  ChartNoAxesColumn as FiBarChart2,
  Activity as FiActivity,
  CircleCheck as FiCheckCircle,
  TriangleAlert as FiAlertTriangle,
  RefreshCw as FiRefreshCw
} from "lucide-react";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type RecentProject = {
  id?: number | string;
  project_name?: string;
  customer_name?: string;
  coordinator?: string;
  project_status?: string;
};

type SalesPerformance = {
  thisMonth?: number;
  lastMonth?: number;
  growth?: number;
};

type DashboardData = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  pendingApproval: number;
  totalRevenue: number;
  monthlyRevenue: number;
  recentProjects: RecentProject[];
  projectsByStatus: Record<string, number>;
  salesPerformance: SalesPerformance;
};

type UserInfo = {
  name_1?: string;
} | null;

function SaleAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    pendingApproval: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    recentProjects: [],
    projectsByStatus: {},
    salesPerformance: {},
  });
  const [salesData, setSalesData] = useState({
    totalSales: 0,
    monthlySales: 0,
    lastMonthSales: 0,
    salesGrowth: 0,
  });

  // Get user info from localStorage
  const [userInfo, setUserInfo] = useState<UserInfo>(null);
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      setUserInfo(user);
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // You can replace these with actual API endpoints
        const [projectsRes, revenueRes, salesRes]: any[] = await Promise.all([
          getProjectDashboardStats(),
          getProjectRevenueStats(),
          getSalesStatsAction(),
        ]);
        setDashboardData({
          totalProjects: projectsRes?.total || 156,
          activeProjects: projectsRes?.active || 23,
          completedProjects: projectsRes?.completed || 98,
          pendingApproval: projectsRes?.pending || 12,
          totalRevenue: revenueRes?.total || 2450000000,
          monthlyRevenue: revenueRes?.monthly || 180000000,
          recentProjects: projectsRes?.recent || [],
          projectsByStatus: projectsRes?.byStatus || {},
          salesPerformance: projectsRes?.performance || {},
        });
        setSalesData({
          totalSales: salesRes?.totalSales || 0,
          monthlySales: salesRes?.monthlySales || 0,
          lastMonthSales: salesRes?.lastMonthSales || 0,
          salesGrowth: salesRes?.salesGrowth || 0,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Use mock data if API fails
        setDashboardData({
          totalProjects: 156,
          activeProjects: 23,
          completedProjects: 98,
          pendingApproval: 12,
          totalRevenue: 2450000000,
          monthlyRevenue: 180000000,
          recentProjects: [],
          projectsByStatus: {
            'ລໍຖ້າດຳເນີນ': 23,
            'ຂັ້ນຕອນສະເໜີຂາຍ': 18,
            'ຂັ້ນຕອນການເຮັດສັນຍາ': 15,
            'ຂັ້ນຕອນດຳເນີນໂຄງການ': 12
          },
          salesPerformance: {
            thisMonth: 15,
            lastMonth: 12,
            growth: 25
          },
        });
        setSalesData({
          totalSales: 120,
          monthlySales: 15,
          lastMonthSales: 12,
          salesGrowth: 25,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('lo-LA', {
      style: 'currency',
      currency: 'LAK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('LAK', '') + ' ກີບ';
  };

  // Quick action cards data
  const quickActions = [
    {
      title: "ສ້າງໂຄງການໃໝ່",
      description: "ເພີ່ມໂຄງການໃໝ່ເຂົ້າສູ່ລະບົບ",
      icon: FiPlusCircle,
      accent: "bg-[rgba(15,118,110,0.12)] text-[var(--theme-primary)]",
      path: "/sale-admin/create-project",
      action: "create"
    },
    {
      title: "ລາຍການໂຄງການ",
      description: "ເບິ່ງແລະຈັດການໂຄງການທັງໝົດ",
      icon: FiEye,
      accent: "bg-[rgba(92,137,195,0.14)] text-[var(--theme-primary-strong)]",
      path: "/sale-admin/list-project",
      action: "view"
    },
    {
      title: "ໃບສະເໜີລາຄາ",
      description: "ເບິ່ງ ແລະ ສ້າງໃບສະເໜີລາຄາ",
      icon: FiFileText,
      accent: "bg-[rgba(123,165,218,0.18)] text-[var(--theme-primary)]",
      path: "/sale-admin/quotations",
      action: "quotes"
    },
    {
      title: "ລາຍງານການຂາຍ",
      description: "ເບິ່ງສະຖິຕິແລະປະສິດທິພາບ",
      icon: FiBarChart2,
      accent: "bg-[rgba(35,79,136,0.14)] text-[var(--theme-primary-strong)]",
      path: "#",
      action: "report"
    }
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
        <div className="theme-card flex min-w-[260px] flex-col items-center rounded-lg px-8 py-9 text-center">
          <div className="theme-icon-badge flex h-16 w-16 items-center justify-center rounded-full">
            <FiRefreshCw className="h-8 w-8 animate-spin" />
          </div>
          <p className="mt-4 text-base font-semibold theme-heading">ກຳລັງໂຫຼດ dashboard...</p>
          <p className="mt-1 text-sm theme-copy">ກຳລັງດຶງຂໍ້ມູນຫຼັກຂອງລະບົບ</p>
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      label: "ໂຄງການທັງໝົດ",
      value: dashboardData.totalProjects,
      note: "ຖານຂໍ້ມູນທັງລະບົບ",
      icon: FiFileText,
    },
    {
      label: "ກຳລັງດຳເນີນ",
      value: dashboardData.activeProjects,
      note: "ຕ້ອງຕິດຕາມຫນ້າງານ",
      icon: FiActivity,
    },
    {
      label: "ລາຍຮັບເດືອນນີ້",
      value: formatCurrency(dashboardData.monthlyRevenue),
      note: `ລາຍຮັບສະສົມ ${formatCurrency(dashboardData.totalRevenue)}`,
      icon: FiDollarSign,
    },
    {
      label: "ລໍຖ້າອະນຸມັດ",
      value: dashboardData.pendingApproval,
      note: "ລາຍການທີ່ຕ້ອງການ action",
      icon: FiAlertTriangle,
    },
  ];

  const quickGlance = [
    { label: "ຂາຍທັງໝົດ", value: salesData.totalSales },
    { label: "ເດືອນນີ້", value: salesData.monthlySales },
    { label: "Growth", value: `+${salesData.salesGrowth}%` },
  ];

  return (
    <div className="space-y-6 px-1 py-2">
      <section className="theme-hero-panel relative overflow-hidden rounded-lg px-6 py-6 md:px-8 md:py-7">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_38%)] lg:block" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85">
              <FiTrendingUp className="h-3.5 w-3.5" />
              Sales Admin Dashboard
            </div>
            <div>
              <h1 className="text-2xl font-semibold md:text-3xl">
                ສະບາຍດີ, {userInfo?.name_1 || "Admin"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/78 md:text-base">
                ຈັດການໂຄງການ, ຕິດຕາມສະຖານະຂາຍ ແລະ ເບິ່ງຈຸດທີ່ຕ້ອງດຳເນີນການໃນຫນ້າດຽວ.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/86">
              <span className="theme-chip-ghost inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                <FiCalendar className="h-4 w-4" />
                {new Date().toLocaleDateString("lo-LA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="theme-chip-ghost rounded-full px-3 py-1.5">
                ລໍຖ້າອະນຸມັດ {dashboardData.pendingApproval}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {quickGlance.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/14 bg-white/10 px-4 py-4 backdrop-blur-sm"
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/62">
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="theme-stat-card rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="theme-stat-label">{item.label}</div>
                  <div className="theme-stat-value mt-3">{item.value}</div>
                </div>
                <div className="theme-icon-badge flex h-12 w-12 items-center justify-center rounded-lg">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 text-sm theme-copy">{item.note}</div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="theme-icon-badge flex h-10 w-10 items-center justify-center rounded-lg">
              <FiTarget className="h-4 w-4" />
            </div>
            <div>
              <h2 className="theme-section-title">ການດຳເນີນການດ່ວນ</h2>
              <p className="theme-section-copy">ເຂົ້າເຖິງຫນ້າວຽກຫຼັກໄດ້ໄວຂຶ້ນ</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {quickActions.map((action) => {
              const IconComponent = action.icon;
              return (
                <button
                  key={action.title}
                  onClick={() => action.path !== "#" && router.push(action.path)}
                  className="theme-card theme-card-hover rounded-lg p-5 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${action.accent}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <span className="theme-chip rounded-full px-2.5 py-1 text-[11px] font-semibold">
                      {action.action === "create" && "ສ້າງໃໝ່"}
                      {action.action === "view" && "ເບິ່ງທັງໝົດ"}
                      {action.action === "quotes" && "Quotation"}
                      {action.action === "report" && "Insight"}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold theme-heading">{action.title}</h3>
                  <p className="mt-2 text-sm leading-6 theme-copy">{action.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="theme-card rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="theme-icon-badge flex h-10 w-10 items-center justify-center rounded-lg">
              <FiBarChart2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="theme-section-title">ສະຖານະໂຄງການ</h2>
              <p className="theme-section-copy">ພາບລວມແບບຍໍ້ຂອງໂຄງການໃນລະບົບ</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {Object.entries(dashboardData.projectsByStatus).length === 0 ? (
              <div className="theme-empty-state rounded-lg px-4 py-6 text-center">
                <p className="text-sm theme-copy">ຍັງບໍ່ມີຂໍ້ມູນສະຖານະ</p>
              </div>
            ) : (
              Object.entries(dashboardData.projectsByStatus).map(([status, count]) => (
                <div
                  key={status}
                  className="theme-page-muted flex items-center justify-between rounded-lg px-4 py-3"
                >
                  <div className="pr-3 text-sm font-medium theme-heading">{status}</div>
                  <div className="text-right">
                    <div className="text-lg font-semibold theme-heading">{count}</div>
                    <div className="text-[11px] theme-copy">ໂຄງການ</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="theme-card rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="theme-icon-badge flex h-10 w-10 items-center justify-center rounded-lg">
              <FiCheckCircle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="theme-section-title">ປະສິດທິພາບການຂາຍ</h2>
              <p className="theme-section-copy">ຕົວເລກສຳຄັນຂອງຮອບເດືອນ</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {[
              {
                label: "ເດືອນນີ້",
                value: dashboardData.salesPerformance.thisMonth || 15,
                note: "ໂຄງການໃໝ່",
              },
              {
                label: "ເດືອນແລ້ວ",
                value: dashboardData.salesPerformance.lastMonth || 12,
                note: "ສະຖິຕິອ້າງອີງ",
              },
              {
                label: "ການເຕີບໂຕ",
                value: `+${dashboardData.salesPerformance.growth || 25}%`,
                note: "ເທົ່າທຽບເດືອນກ່ອນ",
              },
            ].map((item) => (
              <div key={item.label} className="theme-page-muted rounded-lg px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-soft)]">
                  {item.label}
                </div>
                <div className="mt-1 text-2xl font-semibold theme-heading">{item.value}</div>
                <div className="text-sm theme-copy">{item.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="theme-card rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="theme-icon-badge flex h-10 w-10 items-center justify-center rounded-lg">
              <FiMapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 className="theme-section-title">ການເຄື່ອນໄຫວຫຼ້າສຸດ</h2>
              <p className="theme-section-copy">ລາຍການໂຄງການທີ່ຖືກອັບເດດລ່າສຸດ</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {dashboardData.recentProjects.length === 0 ? (
              <div className="theme-empty-state rounded-lg px-4 py-8 text-center">
                <p className="text-sm theme-copy">ບໍ່ມີ recent activity ໃນຂະນະນີ້</p>
              </div>
            ) : (
              dashboardData.recentProjects.slice(0, 5).map((project, index) => (
                <div
                  key={project.id || project.project_name || index}
                  className="theme-page-muted flex items-center justify-between rounded-lg px-4 py-3"
                >
                  <div className="min-w-0 pr-4">
                    <div className="truncate text-sm font-semibold theme-heading">
                      {project.project_name || `Project ${index + 1}`}
                    </div>
                    <div className="mt-1 text-xs theme-copy">
                      {project.customer_name || project.coordinator || "ບໍ່ມີລາຍລະອຽດ"}
                    </div>
                  </div>
                  <div className="text-right text-xs theme-copy">
                    {project.project_status || "Pending"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin"]}>
      <SaleAdminPage />
    </AuthGuard>
  );
}
