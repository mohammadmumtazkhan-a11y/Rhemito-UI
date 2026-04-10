import * as React from "react";
import { useLocation } from "wouter";
import { BellOff, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/contexts/NotificationContext";
import { NotificationItem } from "./NotificationItem";

// ─── Shared panel content ─────────────────────────────────────────────────────

export function NotificationPanelContent({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const { notifications, unreadCount, markRead, markAllRead, dismiss } =
    useNotifications();
  const [, navigate] = useLocation();

  const handleViewArchive = (): void => {
    onClose();
    navigate("/notifications/archive");
  };

  const isEmpty = notifications.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="font-display text-[15px] font-semibold text-foreground">
          Notifications
        </span>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="text-[13px] text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Retention banner */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border flex-shrink-0">
        <Info className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
        <span className="text-[12px] text-muted-foreground/70 leading-tight">
          Notifications are available for 7 days, then archived
        </span>
      </div>

      {/* List */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-10">
          <BellOff className="w-12 h-12 text-muted-foreground/25" />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">All caught up</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              No notifications in the last 7 days
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewArchive}
            className="mt-1 text-[13px]"
          >
            View Archive
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div>
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={markRead}
                onDismiss={dismiss}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Footer */}
      {!isEmpty && (
        <div className="border-t border-border flex-shrink-0">
          <button
            onClick={handleViewArchive}
            className="w-full py-3 text-[13px] text-primary font-medium hover:bg-muted/50 transition-colors text-center"
          >
            View Archived Notifications
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Keep named export for any future use ────────────────────────────────────

/** @deprecated — import NotificationPanelContent directly */
export { NotificationPanelContent as NotificationPanel };
