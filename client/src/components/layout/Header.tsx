import { Bell, ChevronDown, Menu } from "lucide-react";
import { motion } from "framer-motion";

interface HeaderProps {
  userName: string;
  onMenuClick?: () => void;
}

export function Header({ userName, onMenuClick }: HeaderProps) {
  return (
    <motion.header 
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="h-14 md:h-16 bg-white border-b border-border flex items-center justify-between px-3 md:px-6 sticky top-0 z-40"
    >
      <button 
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors -ml-1"
        data-testid="button-mobile-menu"
      >
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-2 md:gap-4 ml-auto">
        <button 
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          data-testid="button-notifications"
        >
          <Bell className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        <div className="flex items-center gap-2 cursor-pointer" data-testid="button-profile-menu">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-teal flex items-center justify-center">
            <span className="text-white font-semibold text-xs md:text-sm">OM</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm font-medium">Individual Profile</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </motion.header>
  );
}
