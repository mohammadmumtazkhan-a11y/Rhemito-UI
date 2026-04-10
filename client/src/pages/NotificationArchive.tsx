import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BellOff, ChevronLeft, ChevronDown } from "lucide-react";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import type { Notification, NotificationsResponse } from "@/contexts/NotificationContext";

// ─── Filter types ─────────────────────────────────────────────────────────────

type ReadFilter = "all" | "read" | "unread";

type CategoryFilter =
  | "all"
  | "payment"
  | "transaction"
  | "refund"
  | "kyc"
  | "system";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All",
  payment: "Payment",
  transaction: "Transaction",
  refund: "Refund",
  kyc: "KYC",
  system: "System",
};

function matchesCategory(n: Notification, cat: CategoryFilter): boolean {
  if (cat === "all") return true;
  const paymentTypes = ["payment_received", "awaiting_payment", "payment_failed"];
  const txnTypes = [
    "transaction_complete",
    "transaction_cancelled_customer",
    "transaction_cancelled_admin",
    "auto_cancel_reminder_15",
    "auto_cancel_reminder_5",
  ];
  const refundTypes = ["refund_processed"];
  const kycTypes = [
    "under_review",
    "review_complete",
    "document_required",
    "document_received",
  ];
  const systemTypes = [
    "maintenance_scheduled",
    "maintenance_complete",
    "preferences_updated",
  ];

  const map: Record<CategoryFilter, string[]> = {
    all: [],
    payment: paymentTypes,
    transaction: txnTypes,
    refund: refundTypes,
    kyc: kycTypes,
    system: systemTypes,
  };

  return map[cat].includes(n.type);
}

// ─── Date grouping ────────────────────────────────────────────────────────────

function groupByDate(
  notifications: Notification[]
): { label: string; items: Notification[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, Notification[]>();

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    d.setHours(0, 0, 0, 0);

    let label: string;
    if (d.getTime() === today.getTime()) {
      label = "Today";
    } else if (d.getTime() === yesterday.getTime()) {
      label = "Yesterday";
    } else {
      label = d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    }

    const existing = groups.get(label) ?? [];
    existing.push(n);
    groups.set(label, existing);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterChip({ active, onClick, children }: FilterChipProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {children}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function NotificationArchive(): React.JSX.Element {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [page, setPage] = useState(1);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications/archive"],
    queryFn: getQueryFn<NotificationsResponse>({ on401: "returnNull" }),
    staleTime: 30_000,
  });

  const allNotifications = data?.notifications ?? [];

  const filtered = useMemo(() => {
    return allNotifications.filter((n) => {
      if (dismissedIds.has(n.id)) return false;
      if (readFilter === "read" && !n.isRead) return false;
      if (readFilter === "unread" && n.isRead) return false;
      if (!matchesCategory(n, categoryFilter)) return false;
      return true;
    });
  }, [allNotifications, readFilter, categoryFilter, dismissedIds]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;
  const groups = groupByDate(paginated);

  const handleDismiss = (id: string): void => {
    setDismissedIds((prev) => {
      const next = new Set<string>(prev);
      next.add(id);
      return next;
    });
  };

  const handleMarkRead = async (id: string): Promise<void> => {
    await apiRequest("PATCH", `/api/notifications/${id}/read`);
    qc.invalidateQueries({ queryKey: ["/api/notifications/archive"] });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 md:px-6 h-14 flex items-center gap-3">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate("/");
            }
          }}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h1 className="font-display text-[16px] font-semibold text-foreground">
          Notification Archive
        </h1>
      </div>

      {/* Filters */}
      <div className="sticky top-14 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {/* Read state chips */}
          {(["all", "unread", "read"] as ReadFilter[]).map((f) => (
            <FilterChip
              key={f}
              active={readFilter === f}
              onClick={() => setReadFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </FilterChip>
          ))}

          <div className="w-px bg-border flex-shrink-0 mx-1" />

          {/* Category chips */}
          {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((c) => (
            <FilterChip
              key={c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
            >
              {CATEGORY_LABELS[c]}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 px-6">
            <BellOff className="w-12 h-12 text-muted-foreground/25" />
            <p className="text-sm font-semibold text-foreground">No archived notifications</p>
            <p className="text-[13px] text-muted-foreground text-center">
              Nothing matches the selected filters
            </p>
          </div>
        )}

        {groups.map(({ label, items }) => (
          <div key={label}>
            {/* Date group header */}
            <div className="px-4 py-2 bg-muted/30 border-b border-border">
              <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                {label}
              </span>
            </div>
            {items.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={() => void handleMarkRead(n.id)}
                onDismiss={handleDismiss}
                archiveMode
              />
            ))}
          </div>
        ))}

        {/* Load more + count */}
        {filtered.length > 0 && (
          <div className="flex flex-col items-center gap-3 py-6 px-4">
            <p className="text-[13px] text-muted-foreground">
              Showing {paginated.length} of {filtered.length}
            </p>
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                className="gap-2 text-[13px]"
              >
                Load More
                <ChevronDown className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
