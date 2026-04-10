import { useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowLeftRight,
  Eye,
  Upload,
  FileCheck,
  Wrench,
  Settings,
  X,
} from "lucide-react";
import type { Notification, NotificationType } from "@/contexts/NotificationContext";

// ─── Icon / colour mapping ────────────────────────────────────────────────────

interface TypeConfig {
  icon: React.ElementType;
  containerClass: string;
  iconClass: string;
  urgent?: boolean;
}

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  payment_received: {
    icon: CheckCircle2,
    containerClass: "bg-teal/10",
    iconClass: "text-teal",
  },
  awaiting_payment: {
    icon: Clock,
    containerClass: "bg-amber/10",
    iconClass: "text-amber",
  },
  payment_failed: {
    icon: AlertTriangle,
    containerClass: "bg-destructive/10",
    iconClass: "text-destructive",
  },
  transaction_complete: {
    icon: CheckCircle2,
    containerClass: "bg-teal/10",
    iconClass: "text-teal",
  },
  transaction_failed: {
    icon: AlertTriangle,
    containerClass: "bg-destructive/10",
    iconClass: "text-destructive",
  },
  transaction_cancelled_customer: {
    icon: XCircle,
    containerClass: "bg-destructive/10",
    iconClass: "text-destructive",
  },
  transaction_cancelled_admin: {
    icon: XCircle,
    containerClass: "bg-destructive/10",
    iconClass: "text-destructive",
  },
  transaction_cancelled_timeout: {
    icon: XCircle,
    containerClass: "bg-destructive/10",
    iconClass: "text-destructive",
  },
  auto_cancel_reminder_15: {
    icon: Clock,
    containerClass: "bg-amber/10",
    iconClass: "text-amber",
  },
  auto_cancel_reminder_5: {
    icon: Clock,
    containerClass: "bg-destructive/10",
    iconClass: "text-destructive",
    urgent: true,
  },
  refund_processed: {
    icon: ArrowLeftRight,
    containerClass: "bg-teal/10",
    iconClass: "text-teal",
  },
  under_review: {
    icon: Eye,
    containerClass: "bg-purple/10",
    iconClass: "text-purple",
  },
  review_complete: {
    icon: CheckCircle2,
    containerClass: "bg-teal/10",
    iconClass: "text-teal",
  },
  document_required: {
    icon: Upload,
    containerClass: "bg-destructive/10",
    iconClass: "text-destructive",
    urgent: true,
  },
  document_received: {
    icon: FileCheck,
    containerClass: "bg-teal/10",
    iconClass: "text-teal",
  },
  maintenance_scheduled: {
    icon: Wrench,
    containerClass: "bg-purple/10",
    iconClass: "text-purple",
  },
  maintenance_complete: {
    icon: CheckCircle2,
    containerClass: "bg-teal/10",
    iconClass: "text-teal",
  },
  preferences_updated: {
    icon: Settings,
    containerClass: "bg-primary/10",
    iconClass: "text-primary",
  },
};

// ─── Relative timestamp ───────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";

  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  /** When true, dismiss only removes from list (archive view) */
  archiveMode?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationItem({
  notification,
  onRead,
  onDismiss,
}: NotificationItemProps): React.JSX.Element {
  const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.preferences_updated;
  const Icon = config.icon;
  const isPresent = useRef(true);
  const [, navigate] = useLocation();

  const handleClick = (): void => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
    navigate(`/notifications/${notification.id}`);
  };

  const handleDismiss = (e: React.MouseEvent): void => {
    e.stopPropagation();
    isPresent.current = false;
    onDismiss(notification.id);
  };

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0, overflow: "hidden" }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => e.key === "Enter" && handleClick()}
          className={cn(
            "group relative flex items-start gap-3 px-4 border-b border-border last:border-b-0 transition-colors duration-150 cursor-pointer",
            notification.isRead
              ? "bg-transparent hover:bg-muted/50"
              : "bg-primary/[0.03] hover:bg-primary/[0.05]",
            !notification.isRead && "border-l-[3px] border-l-primary"
          )}
          style={{ padding: "14px 16px" }}
        >
          {/* Icon container */}
          <div
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
              config.containerClass
            )}
          >
            <Icon className={cn("w-4 h-4", config.iconClass)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "text-[13px] leading-[18px] block",
                  notification.isRead
                    ? "font-medium text-muted-foreground"
                    : "font-semibold text-foreground"
                )}
              >
                {notification.title}
                {config.urgent && (
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-destructive text-destructive-foreground leading-4">
                    Urgent
                  </span>
                )}
              </span>

              {/* Timestamp — top-right */}
              <span className="flex-shrink-0 text-[11px] text-muted-foreground/60 mt-0.5">
                {formatTimestamp(notification.createdAt)}
              </span>
            </div>

            <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2 leading-[18px]">
              {notification.body}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            className={cn(
              "absolute right-3 top-3 flex items-center justify-center w-7 h-7 rounded-md",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              "transition-opacity duration-150",
              // Always visible on mobile, hover-only on desktop
              "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            )}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
