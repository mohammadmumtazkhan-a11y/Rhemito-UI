import { useState, useEffect } from "react";
import { Wrench, CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/contexts/NotificationContext";
import type { Notification } from "@/contexts/NotificationContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaintenanceData {
  date?: string;
  start?: string;
  end?: string;
  timezone?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMaintenanceScheduled(
  notifications: Notification[]
): (Notification & { data: MaintenanceData }) | null {
  const found = notifications.find((n) => n.type === "maintenance_scheduled");
  if (!found) return null;
  return found as Notification & { data: MaintenanceData };
}

function getMaintenanceComplete(
  notifications: Notification[]
): Notification | null {
  return notifications.find((n) => n.type === "maintenance_complete") ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MaintenanceBanner(): React.JSX.Element | null {
  const { notifications } = useNotifications();
  const [completeDismissed, setCompleteDismissed] = useState(false);

  const scheduled = getMaintenanceScheduled(notifications);
  const complete = getMaintenanceComplete(notifications);

  // Auto-dismiss maintenance complete banner after 30 seconds
  useEffect(() => {
    if (complete && !completeDismissed) {
      const timer = setTimeout(() => {
        setCompleteDismissed(true);
      }, 30_000);
      return () => clearTimeout(timer);
    }
  }, [complete, completeDismissed]);

  const showComplete = complete && !completeDismissed;
  const showScheduled = scheduled && !showComplete;

  if (!showScheduled && !showComplete) return null;

  return (
    <AnimatePresence>
      {showScheduled && scheduled && (
        <motion.div
          key="maintenance-scheduled"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed top-14 md:top-16 left-0 right-0 z-40 overflow-hidden"
        >
          <div className="bg-purple px-4 py-2.5 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-white flex-shrink-0" />
            <p className="text-white text-[13px] leading-snug flex-1">
              <span className="font-semibold">Scheduled Maintenance:</span>{" "}
              Rhemito will be unavailable
              {scheduled.data?.date ? ` on ${scheduled.data.date}` : ""}
              {scheduled.data?.start ? ` from ${scheduled.data.start}` : ""}
              {scheduled.data?.end ? ` to ${scheduled.data.end}` : ""}
              {scheduled.data?.timezone ? ` ${scheduled.data.timezone}` : ""}
            </p>
          </div>
        </motion.div>
      )}

      {showComplete && (
        <motion.div
          key="maintenance-complete"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed top-14 md:top-16 left-0 right-0 z-40 overflow-hidden"
        >
          <div className="bg-teal px-4 py-2.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
            <p className="text-white text-[13px] leading-snug flex-1">
              {complete?.body ?? "Maintenance is now complete. Rhemito is back online."}
            </p>
            <button
              onClick={() => setCompleteDismissed(true)}
              aria-label="Dismiss maintenance banner"
              className={cn(
                "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md",
                "text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
