import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MaintenanceBanner } from "@/components/notifications/MaintenanceBanner";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);


  return (
    <div className="min-h-screen bg-background">
      {/* AC 8.2 — Non-dismissible in-app banner shown whenever a maintenance_scheduled
          notification is active (auto-disappears via dismissible complete banner). */}
      <MaintenanceBanner />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}

      />
      <div className="lg:ml-56 transition-all duration-300">
        <Header userName="Olayinka" onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-3 md:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
