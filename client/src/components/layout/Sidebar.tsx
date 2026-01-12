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
  ChevronLeft,
  Wallet,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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

export function Sidebar() {
  const [location] = useLocation();

  return (
    <motion.aside 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-56 bg-white border-r border-border h-screen flex flex-col fixed left-0 top-0"
    >
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center">
          <img 
            src="/logo.png" 
            alt="Rhemito Logo" 
            className="w-10 h-10 object-contain"
          />
        </div>
        <button 
          className="ml-auto w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white hover:bg-primary/90 transition-colors"
          data-testid="button-collapse-sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          
          if (!item.enabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
                data-testid={`link-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </div>
            );
          }
          
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 4 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  isActive 
                    ? "text-primary bg-primary/5" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                data-testid={`link-${item.label.toLowerCase()}`}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
                {item.label}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <button 
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </motion.aside>
  );
}
