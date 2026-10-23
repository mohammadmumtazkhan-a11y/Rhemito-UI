import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { LegalStrip } from "./LegalStrip";
import { MaintenanceBanner } from "@/components/notifications/MaintenanceBanner";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * Approved Rhemito MITO-BLUE signed-in shell (match www.rhemito.com MainLayout):
 * white canvas, sidebar + main, LegalStrip on the right, gutters 20px / 50px.
 * Do not wrap pages in maxW + center.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-white">
      <MaintenanceBanner />
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <div
        className={cn(
          "flex min-h-screen w-full flex-col lg:flex-row lg:gap-10",
          "pt-0 lg:pt-16"
        )}
      >
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
        <main
          className={cn(
            "relative z-[99] flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-white",
            "px-5 pb-20 pt-[50px] xl:px-[50px]",
            sidebarCollapsed ? "lg:ml-20" : "lg:ml-60"
          )}
        >
          <LegalStrip />
          <div className="min-w-0 w-full max-w-full flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
