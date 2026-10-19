import { useRewards } from "@/hooks/use-rewards";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  BarChart2,
  FileText,
  Users,
  ShieldCheck,
  LifeBuoy,
  Settings,
  LogOut,
  X,
  Building2,
  Gift,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItemData {
  icon: any;
  label: string;
  href: string;
  enabled: boolean;
  tooltip?: string;
}

const overviewItem: NavItemData = {
  icon: LayoutDashboard,
  label: "Overview",
  href: "/",
  enabled: true,
};

const transactionsItem: NavItemData = {
  icon: BarChart2,
  label: "Transactions",
  href: "/transactions",
  enabled: true,
};

const invoicesItem: NavItemData = {
  icon: FileText,
  label: "Invoices",
  href: "/invoices",
  enabled: true,
};

const sendersRecipientsItem: NavItemData = {
  icon: Users,
  label: "Senders & Recipients",
  href: "/senders-recipients",
  enabled: true,
};

const collectionsAccountsItem: NavItemData = {
  icon: Building2,
  label: "Settlement bank account",
  href: "/payout-accounts",
  enabled: true,
  tooltip: "You receive money here",
};

const otherNavItems: NavItemData[] = [
  { icon: ShieldCheck, label: "Compliance", href: "/compliance", enabled: true },
  { icon: LifeBuoy, label: "Support", href: "/support", enabled: true },
  { icon: Settings, label: "Settings", href: "/settings", enabled: true },
];

const bonusItem: NavItemData = {
  icon: Gift,
  label: "Bonus & Discounts",
  href: "/bonus-discounts",
  enabled: true,
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  isOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [location, setLocation] = useLocation();
  // "Rewards waiting!" only when there is bonus to use or a fresh offer (AC-5.1.12)
  const rewards = useRewards();
  const rewardsWaiting = Boolean(
    rewards.data &&
      (rewards.data.wallet.balances.some((b) => b.available > 0) ||
        rewards.data.latestOffer)
  );
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // session may already be gone
    }
    toast({
      title: "Logged out",
      description: "You have been signed out successfully.",
    });
    setLocation("/sign-in-sign-up");
  };

  const NavItem = ({
    item,
    className,
  }: {
    item: NavItemData;
    className?: string;
  }) => {
    const isActive =
      location === item.href ||
      (item.href !== "/" && location.startsWith(item.href));

    const content = (
      <div
        className={cn(
          "flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-[13px] transition-all duration-150",
          !item.enabled && "opacity-50 cursor-not-allowed",
          item.enabled && "cursor-pointer",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-blue-50/90 text-blue-700 font-semibold"
            : "text-blue-600 hover:bg-blue-50/50 hover:text-blue-700 font-normal",
          className
        )}
        data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {item.href === "/payout-accounts" && (
          <span className="sr-only" data-testid="link-collections-accounts" />
        )}
        <item.icon
          className={cn(
            "w-[18px] h-[18px] shrink-0",
            isActive ? "text-blue-700" : "text-blue-600"
          )}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </div>
    );

    const wrappedContent =
      item.tooltip || collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-slate-900 text-white border-0"
          >
            <p>{item.tooltip || item.label}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        content
      );

    if (!item.enabled) return wrappedContent;

    return (
      <Link key={item.href} href={item.href} onClick={onClose}>
        <div className="group">{wrappedContent}</div>
      </Link>
    );
  };

  const renderNavList = (isMobileDrawer: boolean) => {
    const isCollapsed = !isMobileDrawer && collapsed;
    return (
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        <NavItem item={overviewItem} />
        <NavItem item={transactionsItem} />

        {/* Bonus & Discounts (Reward$ position in reference layout) */}
        <Link href={bonusItem.href} onClick={onClose}>
          <div
            className={cn(
              "flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-[13px] transition-all duration-150 cursor-pointer",
              isCollapsed && "justify-center px-2",
              location === bonusItem.href
                ? "bg-blue-50/90 text-blue-700 font-semibold"
                : "text-blue-600 hover:bg-blue-50/50 hover:text-blue-700 font-normal"
            )}
          >
            <Gift className="w-[18px] h-[18px] text-blue-600 shrink-0" />
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <span className="block truncate">Bonus & Discounts</span>
                {rewardsWaiting && (
                  <span className="text-[10px] font-medium text-blue-600/80">
                    Rewards waiting!
                  </span>
                )}
              </div>
            )}
            {rewardsWaiting && !isCollapsed && (
              <div
                className="flex items-center gap-1"
                data-testid="rewards-waiting-badge"
              >
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-2xs">
                  NEW
                </span>
              </div>
            )}
          </div>
        </Link>

        <NavItem item={invoicesItem} />
        <NavItem item={sendersRecipientsItem} />
        <NavItem item={collectionsAccountsItem} />

        {otherNavItems.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}

        {/* Logout item in the navigation list matching reference layout */}
        <button
          type="button"
          className={cn(
            "flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-[13px] font-normal text-blue-600 hover:text-red-600 hover:bg-red-50/60 w-full transition-all duration-150 cursor-pointer",
            isCollapsed && "justify-center px-2"
          )}
          data-testid="button-logout"
          onClick={handleLogout}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </nav>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex bg-white border-r border-slate-200/80 h-[calc(100vh-4rem)] flex-col fixed left-0 top-16 z-30 transition-all duration-300",
          collapsed ? "w-20" : "w-60"
        )}
      >
        {/* Reference circular collapse toggle button on the right border */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3.5 top-7 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center transition-colors cursor-pointer z-40"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
        {renderNavList(false)}
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
              className="fixed left-0 top-0 w-72 bg-white h-screen flex flex-col z-50 lg:hidden shadow-2xl"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/logo.png"
                    alt="Rhemito Logo"
                    className="w-8 h-8 object-contain"
                  />
                  <span className="font-display font-bold text-lg text-slate-900">
                    Rhemito
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                  data-testid="button-collapse-sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {renderNavList(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

