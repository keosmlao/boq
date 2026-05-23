"use client";


import AuthGuard from "@/_components/AuthGuard";
import { useEffect, useState, useMemo } from "react";
import { Loader2, Calendar, RefreshCw } from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";
import { getWorkOrders } from "@/_actions/work-orders";
import ViewSwitcher, { type ViewMode } from "@/_components/odoo/ViewSwitcher";
import KanbanBoard, { type KanbanColumn } from "@/_components/odoo/KanbanBoard";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


function WorkInProgressToday() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wip-today-list-view");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("wip-today-list-view", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const loadWorkOrders = async () => {
    setLoading(true);
    try {
      const res = await getWorkOrders({ status: 'in_progress' });
      setOrders(res?.success ? (res.data as any[]) : []);
    } catch (err) {
      console.error("Failed to load work orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const inProgressToday = useMemo(() => {
    return orders.filter(o => {
      if (!o.scheduled_date) return false;
      const scheduledDate = new Date(o.scheduled_date);
      scheduledDate.setHours(0, 0, 0, 0);
      return scheduledDate.getTime() === today.getTime();
    });
  }, [orders, today]);

  usePageHeader({
    title: "ງານທີ່ກຳລັງດຳເນີນວັນນີ້",
    subtitle: `${inProgressToday.length} ລາຍການ`,
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => loadWorkOrders(),
        disabled: loading,
      },
    ],
  });

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return (
      <>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-3 flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
            <span className="text-gray-500 tabular-nums">{inProgressToday.length} ລາຍການ</span>
            <div className="ml-auto">
              <ViewSwitcher value={viewMode} onChange={setViewMode} />
            </div>
          </div>
          {loading ? (
            <div className="text-center py-10">
              <Loader2 className="animate-spin inline-block text-gray-400" size={32} />
            </div>
          ) : viewMode === "kanban" ? (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-3">
              <KanbanBoard<any>
                columns={[
                  {
                    id: "in_progress",
                    title: "ກຳລັງດຳເນີນ",
                    color: "#3b82f6",
                    records: inProgressToday,
                  },
                ]}
                getCardId={(o: any) => String(o.id)}
                renderCard={(o: any) => (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[11px] font-semibold text-[var(--theme-primary)]">
                        {o.code}
                      </span>
                      <span className="flex-shrink-0 text-[10px] text-[var(--theme-text-mute)] tabular-nums">
                        {formatDate(o.scheduled_date)}
                      </span>
                    </div>
                    <div className="truncate text-[12px] font-semibold text-[var(--theme-text)]">
                      {o.project_name || o.project_code}
                    </div>
                    {o.task_name && (
                      <div className="truncate text-[10px] text-[var(--theme-text-mute)]">
                        {o.task_name}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--theme-text-mute)]">
                      <span className="truncate">{o.technician_id || ""}</span>
                      <span className="tabular-nums" />
                    </div>
                  </div>
                )}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      WO Number
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Technician
                    </th>
                     <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scheduled Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inProgressToday.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-sm text-gray-500">
                        No work orders in progress for today.
                      </td>
                    </tr>
                  ) : (
                    inProgressToday.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">{order.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{order.project_name || order.project_code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{order.task_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{order.technician_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(order.scheduled_date)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "head_technician"]}>
      <WorkInProgressToday />
    </AuthGuard>
  );
}
