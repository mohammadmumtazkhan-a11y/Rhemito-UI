import { Bell, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

interface HeaderProps {
  userName: string;
}

export function Header({ userName }: HeaderProps) {
  return (
    <motion.header 
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="h-16 bg-white border-b border-border flex items-center justify-end px-6 sticky top-0 z-10"
    >
      <div className="flex items-center gap-4">
        <button 
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          data-testid="button-notifications"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        <div className="flex items-center gap-3 cursor-pointer" data-testid="button-profile-menu">
          <div className="w-9 h-9 rounded-full bg-teal flex items-center justify-center">
            <span className="text-white font-semibold text-sm">OM</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Individual Profile</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </motion.header>
  );
}
