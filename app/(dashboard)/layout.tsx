import Sidebar from "@/_components/Sidebar";
import TopBar from "@/_components/TopBar";
import { PageHeaderProvider } from "@/_components/PageHeader";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="theme-shell-bg flex h-screen">
      <Sidebar />
      <main className="theme-dashboard-shell theme-scrollbar flex-1 h-full overflow-auto">
        <PageHeaderProvider>
          <TopBar />
          <div className="w-full">{children}</div>
        </PageHeaderProvider>
      </main>
    </div>
  );
}
