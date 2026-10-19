import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MaintenanceBanner } from "@/components/notifications/MaintenanceBanner";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* AC 8.2 — Non-dismissible in-app banner shown whenever a maintenance_scheduled
          notification is active (auto-disappears via dismissible complete banner). */}
      <MaintenanceBanner />
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-60"
        )}
      >
        <main className="p-4 sm:p-6 lg:p-8 pb-16 md:pb-10 max-w-[1400px]">
          {children}
        </main>
      </div>
    </div>
  );
}

