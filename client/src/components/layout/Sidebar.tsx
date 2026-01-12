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

export function Sidebar({ isOpen = false, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const [location] = useLocation();

  const NavItem = ({ item, showLabel = true }: { item: typeof navItems[0], showLabel?: boolean }) => {
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
    
    if (!item.enabled) {
      const content = (
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/50 cursor-not-allowed",
            !showLabel && "justify-center"
          )}
          data-testid={`link-${item.label.toLowerCase()}`}
        >
          <item.icon className="w-5 h-5 shrink-0" />
          {showLabel && item.label}
        </div>
      );

      if (!showLabel) {
        return (
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      }
      return content;
    }
    
    const content = (
      <Link key={item.href} href={item.href}>
        <motion.div
          whileHover={{ x: showLabel ? 4 : 0 }}
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
            !showLabel && "justify-center",
            isActive 
              ? "text-primary bg-primary/5" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          data-testid={`link-${item.label.toLowerCase()}`}
        >
          <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
          {showLabel && item.label}
        </motion.div>
      </Link>
    );

    if (!showLabel) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return content;
  };

  const sidebarContent = (showLabels: boolean) => (
    <>
      <div className={cn("p-4 flex items-center", showLabels ? "gap-3 p-6" : "justify-center")}>
        <div className={cn("flex items-center justify-center", showLabels ? "w-10 h-10" : "w-8 h-8")}>
          <img 
            src="/logo.png" 
            alt="Rhemito Logo" 
            className={cn("object-contain", showLabels ? "w-10 h-10" : "w-8 h-8")}
          />
        </div>
        {showLabels && (
          <button 
            onClick={onClose || onToggleCollapse}
            className="ml-auto w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white hover:bg-primary/90 transition-colors"
            data-testid="button-collapse-sidebar"
          >
            {onClose ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.href} item={item} showLabel={showLabels} />
        ))}
      </nav>

      <div className="px-2 py-4 border-t border-border">
        {showLabels ? (
          <button 
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="flex items-center justify-center p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
                data-testid="button-logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside 
        className={cn(
          "hidden lg:flex bg-white border-r border-border h-screen flex-col fixed left-0 top-0 z-50 transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {sidebarContent(!collapsed)}
        
        {/* Collapse toggle button */}
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
          data-testid="button-toggle-collapse"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
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
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
