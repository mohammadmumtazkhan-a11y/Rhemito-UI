import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  overdue: "bg-amber-50 text-amber-700 border-amber-200",
  payment_processing: "bg-purple-50 text-purple-700 border-purple-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  overdue: "Overdue",
  payment_processing: "Payment Processing",
  paid: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function InvoiceStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_STYLES[status] ?? STATUS_STYLES.sent, className)}
      data-testid={`status-badge-${status}`}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function invoiceStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
