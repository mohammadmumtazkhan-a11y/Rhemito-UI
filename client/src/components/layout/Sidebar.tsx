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
  Gift,
  Inbox,
  Send,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface NavItemData {
  icon: any;
  label: string;
  href: string;
  enabled: boolean;
  tooltip?: string;
  gradient?: string;
}

const overviewItem: NavItemData = { icon: LayoutDashboard, label: "Overview", href: "/", enabled: true, gradient: "from-blue-500 to-indigo-600" };

const moneySentItems: NavItemData[] = [
  { icon: ArrowLeftRight, label: "Transactions", href: "/test-checkout", enabled: true },
  { icon: Users, label: "Recipients", href: "/recipients", enabled: true },
];

const paymentsReceivedItems: NavItemData[] = [
  { icon: Wallet, label: "Received Payments", href: "/payments", enabled: true },
  { icon: UserCheck, label: "Senders", href: "/senders", enabled: true },
  { icon: Building2, label: "Collections Accounts", href: "/payout-accounts", enabled: true, tooltip: "You receive money here" },
];

const otherNavItems: NavItemData[] = [
  { icon: Shield, label: "Compliance", href: "/compliance", enabled: true },
  { icon: HelpCircle, label: "Support", href: "/support", enabled: true },
  { icon: Settings, label: "Settings", href: "/settings", enabled: true },
];

// Special highlighted item
const bonusItem: NavItemData = { icon: Gift, label: "Bonus & Discounts", href: "/bonus-discounts", enabled: true, gradient: "from-amber-400 to-orange-500" };

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const [location] = useLocation();

  const NavItem = ({ item, className }: { item: NavItemData, className?: string }) => {
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));

    const content = (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
          !item.enabled && "opacity-50 cursor-not-allowed",
          item.enabled && "cursor-pointer",
          isActive
            ? "bg-gradient-to-r from-primary/10 to-indigo-500/10 text-primary shadow-sm border border-primary/20"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 hover:shadow-sm",
          className
        )}
        data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
          isActive
            ? `bg-gradient-to-br ${item.gradient || 'from-primary to-indigo-600'} shadow-md`
            : "bg-gray-100 group-hover:bg-gray-200"
        )}>
          <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-gray-500")} />
        </div>
        <span className={cn("font-medium", isActive && "font-semibold")}>{item.label}</span>
      </div>
    );

    const wrappedContent = item.tooltip ? (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="bg-gray-900 text-white border-0">
          <p>{item.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    ) : (
      content
    );

    if (!item.enabled) return wrappedContent;

    return (
      <Link key={item.href} href={item.href} onClick={onClose}>
        <motion.div whileHover={{ x: 4 }} className="group">
          {wrappedContent}
        </motion.div>
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Header with Logo */}
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
          className="ml-auto w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors lg:hidden"
          data-testid="button-collapse-sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        <NavItem item={overviewItem} />

        {/* Money Sent Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="money-sent" className="border-none">
            <AccordionTrigger className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 hover:no-underline transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-md shadow-teal-200/50">
                  <Send className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">Money Sent</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-1 pt-1">
              <div className="ml-5 mt-1 border-l-2 border-gradient-to-b from-teal-200 to-emerald-200 pl-3 space-y-1">
                {moneySentItems.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Payments Received Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="payments-received" className="border-none">
            <AccordionTrigger className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 hover:no-underline transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md shadow-violet-200/50">
                  <Inbox className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">Payments Received</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-1 pt-1">
              <div className="ml-5 mt-1 border-l-2 border-violet-200 pl-3 space-y-1">
                {paymentsReceivedItems.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Divider */}
        <div className="py-2">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        </div>

        {otherNavItems.slice(0, 2).map((item) => (
          <NavItem key={item.href} item={item} />
        ))}

        {/* Premium Bonus & Discounts Item */}
        <Link href={bonusItem.href} onClick={onClose}>
          <motion.div
            whileHover={{ x: 4, scale: 1.02 }}
            className="group relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 via-orange-400/20 to-pink-400/20 rounded-xl blur-sm group-hover:blur-md transition-all duration-300" />
            <div className={cn(
              "relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-300",
              "bg-gradient-to-r from-amber-50 via-orange-50 to-pink-50",
              "border border-amber-200/50 hover:border-amber-300",
              "text-amber-800 hover:text-amber-900",
              "shadow-sm hover:shadow-md hover:shadow-amber-100/50",
              location === bonusItem.href && "ring-2 ring-amber-400/50"
            )}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-300/50 group-hover:shadow-orange-400/50 transition-all duration-300">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className="block">Bonus & Discounts</span>
                <span className="text-[10px] font-medium text-amber-600/80">Rewards waiting!</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gradient-to-r from-amber-500 to-orange-500"></span>
                </span>
                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  NEW
                </span>
              </div>
            </div>
          </motion.div>
        </Link>

        {otherNavItems.slice(2).map((item) => (
          <NavItem key={item.href} item={item} />
        ))}

      </nav>

      {/* Footer with Logout */}
      <div className="px-3 py-4 border-t border-gray-100 bg-gradient-to-t from-gray-50/50 to-transparent">
        <motion.button
          whileHover={{ x: 4 }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 w-full transition-all duration-200 group"
          data-testid="button-logout"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-gradient-to-br group-hover:from-red-400 group-hover:to-rose-500 flex items-center justify-center transition-all duration-200">
            <LogOut className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          </div>
          Logout
        </motion.button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex bg-white/95 backdrop-blur-sm border-r border-gray-100 h-screen flex-col fixed left-0 top-0 z-50 transition-all duration-300 w-56 shadow-xl shadow-gray-200/50">
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
              className="fixed left-0 top-0 w-72 bg-white h-screen flex flex-col z-50 lg:hidden shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
