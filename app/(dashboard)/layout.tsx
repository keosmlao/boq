import Sidebar from "@/_components/Sidebar";
import TopBar from "@/_components/TopBar";
import { NavigationProgress } from "@/_components/NavigationProgress";
import { PageHeaderProvider } from "@/_components/PageHeader";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <PageHeaderProvider>
      <NavigationProgress />
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)]">
        <Sidebar />
        <main className="theme-scrollbar flex h-full flex-1 flex-col overflow-hidden">
          <TopBar />
          <div className="theme-scrollbar flex-1 overflow-auto">
            <div className="w-full p-4 md:p-6">{children}</div>
          </div>
        </main>
      </div>
    </PageHeaderProvider>
  );
}
