import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer } from "vaul";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/contexts/NotificationContext";
import { NotificationPanelContent } from "./NotificationPanel";

// ─── Badge ────────────────────────────────────────────────────────────────────

function NotificationBadge({ count }: { count: number }): React.JSX.Element | null {
  if (count === 0) return null;

  const label = count > 9 ? "9+" : String(count);

  return (
    <motion.span
      key={count > 9 ? "9+" : count}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      className={cn(
        "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1",
        "bg-destructive text-destructive-foreground",
        "ring-2 ring-white dark:ring-card",
        "rounded-full text-[10px] font-bold leading-none",
        "flex items-center justify-center pointer-events-none"
      )}
      aria-hidden="true"
    >
      {label}
    </motion.span>
  );
}

// ─── Shared inner markup for the bell icon ───────────────────────────────────

function BellIcon({
  unreadCount,
}: {
  unreadCount: number;
}): React.JSX.Element {
  return (
    <>
      <Bell className="w-4 h-4 md:w-5 md:h-5" />
      <AnimatePresence>
        {unreadCount > 0 && <NotificationBadge count={unreadCount} />}
      </AnimatePresence>
    </>
  );
}

// ─── Media query hook — mobile < 640px ──────────────────────────────────────

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 639px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent): void => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function NotificationBell(): React.JSX.Element {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const buttonClass = cn(
    "relative p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
    isOpen
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:text-foreground hover:bg-muted"
  );

  // Render only ONE variant — prevents the drawer Portal from leaking into desktop
  if (isMobile) {
    return (
      <Drawer.Root
        open={isOpen}
        onOpenChange={setIsOpen}
        snapPoints={[0.85]}
        activeSnapPoint={0.85}
        setActiveSnapPoint={() => undefined}
      >
        <Drawer.Trigger
          className={buttonClass}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          data-testid="button-notifications"
        >
          <BellIcon unreadCount={unreadCount} />
        </Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Drawer.Content
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50 flex flex-col",
              "bg-card rounded-t-2xl border border-border max-h-[85vh]"
            )}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>
            <NotificationPanelContent onClose={() => setIsOpen(false)} />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  // Desktop (>= 640px)
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={buttonClass}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          data-testid="button-notifications"
        >
          <BellIcon unreadCount={unreadCount} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "w-[380px] max-h-[420px] p-0 overflow-hidden",
          "flex flex-col shadow-lg border border-border rounded-xl"
        )}
      >
        <NotificationPanelContent onClose={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
