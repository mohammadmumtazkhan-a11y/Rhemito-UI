import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  UserCheck,
  Shield,
  HelpCircle,
  Settings,
  LogOut,
  X,
  Wallet,
  Building2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/", enabled: true },
  { icon: Wallet, label: "Payments", href: "/payments", enabled: true },
  { icon: ArrowLeftRight, label: "Transactions", href: "/transactions", enabled: false },
  { icon: Users, label: "Recipients", href: "/recipients", enabled: false },
  { icon: UserCheck, label: "Senders", href: "/senders", enabled: true },
  { icon: Building2, label: "Payout Accounts", href: "/payout-accounts", enabled: true },
  { icon: Shield, label: "Compliance", href: "/compliance", enabled: false },
  { icon: HelpCircle, label: "Support", href: "/support", enabled: false },
  { icon: Settings, label: "Settings", href: "/settings", enabled: false },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const [location] = useLocation();

  const NavItem = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));

    if (!item.enabled) {
      return (
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
          )}
          data-testid={`link-${item.label.toLowerCase()}`}
        >
          <item.icon className="w-5 h-5 shrink-0" />
          {item.label}
        </div>
      );
    }

    return (
      <Link key={item.href} href={item.href}>
        <motion.div
          whileHover={{ x: 4 }}
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
            isActive
              ? "text-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          data-testid={`link-${item.label.toLowerCase()}`}
        >
          <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
          {item.label}
        </motion.div>
      </Link>
    );
  };

  const sidebarContent = (
    <>
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Rhemito Logo"
            className="w-10 h-10 object-contain"
          />
        </div>
        <button
          onClick={onClose}
          className="ml-auto w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white hover:bg-primary/90 transition-colors lg:hidden"
          data-testid="button-collapse-sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}
      </nav>

      <div className="px-2 py-4 border-t border-border">
        <button
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex bg-white border-r border-border h-screen flex-col fixed left-0 top-0 z-50 transition-all duration-300 w-56"
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:hidden"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 w-72 bg-white h-screen flex flex-col z-50 lg:hidden shadow-xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
