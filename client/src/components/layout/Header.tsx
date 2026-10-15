import { ChevronDown, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/hooks/use-auth";
import { profileLabel, userInitials } from "@/lib/userDisplay";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  return (
    <motion.header 
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="h-14 md:h-16 bg-white border-b border-border flex items-center justify-between px-3 md:px-6 sticky top-0 z-40"
    >
      <button 
        onClick={onMenuClick}
        className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 active:scale-95 transition-all -ml-1 text-slate-700"
        data-testid="button-mobile-menu"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2 md:gap-4 ml-auto">
        <NotificationBell />

        <div className="flex items-center gap-2 cursor-pointer" data-testid="button-profile-menu">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-teal flex items-center justify-center">
            <span className="text-white font-semibold text-xs md:text-sm" data-testid="header-initials">{userInitials(user)}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm font-medium" data-testid="header-profile-label">{profileLabel(user)}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </motion.header>
  );
}
