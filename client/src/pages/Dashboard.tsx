import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, Receipt, ArrowRight, Gift, Copy, Check, Sparkles, Search, 
  ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight, Mail, 
  XCircle, FilePlus2, FileText, Users, CreditCard, Wallet, 
  Building2, X 
} from "lucide-react";
import { CancelTransactionModal, type TransactionDetails } from "@/components/CancelTransactionModal";
import { CancelMoneyRequestDialog } from "@/components/transactions/CancelMoneyRequestDialog";
import { MoneyRequestDetailsDialog } from "@/components/transactions/MoneyRequestDetailsDialog";
import { CancelInvoiceDialog } from "@/components/invoices/CancelInvoiceDialog";
import { cancelRequest, getRequests, resendEmail, type MoneyRequestView } from "@/lib/requests";
import { invoiceListUrl, resendInvoiceNotificationRequest, type InvoiceListItem, type InvoiceListResponse } from "@/lib/invoices";
import { fetchCampaigns } from "@/lib/groupPay";
import { cancelSendMoneyTransaction, getSendMoneyTransactions, toSendMoneyRow } from "@/lib/sendMoney";
import {
  TYPE_BADGES,
  fromCampaign,
  fromInvoice,
  fromMoneyRequest,
  invoiceActionable,
  moneyRequestAwaiting,
  moneyRequestLinkShareable,
  type TransactionType,
  type UnifiedTransactionRow,
} from "@/lib/unifiedTransactions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const recentRecipients = [
  { id: 1, name: "Oluwas...", initials: "OA", color: "bg-blue-500" },
  { id: 2, name: "Profilea", initials: "PL", color: "bg-purple-500" },
  { id: 3, name: "Testing...", initials: "T", color: "bg-gray-400" },
  { id: 4, name: "Steve", initials: "SS", color: "bg-teal" },
];

const scheduledTransactions = [
  {
    id: "SCH001",
    recipient: "Monthly Rent",
    service: "Bank Transfer",
    date: "01 Nov 2025",
    amount: "GBP 800.00",
    status: "scheduled",
  },
];

/** Shape shared by the send-money prototype rows (recent + scheduled). */
interface SendMoneyTx {
  id: string;
  recipient: string;
  service: string;
  date: string;
  amount: string;
  status: string;
}

type TypeFilter = "all" | TransactionType;

/** Unified transactions table page size — 20 records max per page. */
const TRANSACTIONS_PAGE_SIZE = 20;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "send_money", label: "Send Money" },
  { value: "receive_money", label: "Receive Money" },
  { value: "invoice", label: "Invoices" },
  { value: "campaign", label: "Campaigns" },
];

/** One entry per row of the unified transactions table, sorted by dateSort. */
type MergedRow =
  | { kind: "send_money"; scheduled: boolean; dateSort: number; tx: SendMoneyTx }
  | { kind: "receive_money" | "invoice" | "campaign"; dateSort: number; row: UnifiedTransactionRow };

function SendMoneyRow({ tx, scheduled, onCancel }: { tx: SendMoneyTx; scheduled: boolean; onCancel: (tx: SendMoneyTx) => void }) {
  // Resend is offered ONLY for terminal (settled) statuses.
  // Terminal = completed (successful), failed, cancelled (aborted).
  // In-flight states (awaiting_payment, pending, scheduled) never show Resend.
  // Cancel is offered ONLY while awaiting_payment.
  const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;
  const isTerminal = (TERMINAL_STATUSES as readonly string[]).includes(tx.status);
  const canCancel = tx.status === "awaiting_payment";
  return (
    <TableRow
      data-testid={scheduled ? `row-scheduled-${tx.id}` : `row-transaction-${tx.id}`}
      className={cn(
        "hover:bg-slate-50/80 transition-colors duration-150 group border-b border-slate-100 last:border-b-0",
        tx.status === "awaiting_payment" && "border-l-2 border-l-amber-400 bg-amber-50/15"
      )}
    >
      <TableCell className="font-semibold text-blue-600 text-sm py-4 pl-4 sm:pl-6">
        <div className="font-mono text-[13px] tracking-tight">{tx.id}</div>
        <div className="text-xs font-bold text-gray-900 mt-0.5 sm:hidden">{tx.amount}</div>
      </TableCell>
      <TableCell className="text-sm font-medium text-gray-900 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-100/70 text-blue-700 font-semibold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {tx.recipient.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-slate-900">{tx.recipient}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-gray-500">
              <span className={cn("w-1.5 h-1.5 rounded-full", TYPE_BADGES.send_money.dot)} />
              {TYPE_BADGES.send_money.label}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-gray-500 text-sm hidden md:table-cell py-4">
        <span className="inline-flex items-center text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
          {tx.service}
        </span>
      </TableCell>
      <TableCell className="text-gray-500 text-sm hidden sm:table-cell py-4">
        <span className="text-xs text-slate-500 font-medium">{tx.date}</span>
      </TableCell>
      <TableCell className="text-right font-bold text-gray-900 text-sm py-4 hidden sm:table-cell">
        <div className="flex items-center justify-end gap-1">
          <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" aria-hidden />
          <span className="font-semibold text-slate-900">{tx.amount}</span>
        </div>
      </TableCell>
      <TableCell className="text-center py-4">
        {scheduled ? (
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Scheduled
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <AnimatePresence mode="wait">
              {tx.status === "cancelled" ? (
                <motion.span
                  key="cancelled"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Cancelled
                </motion.span>
              ) : tx.status === "completed" ? (
                <motion.span
                  key="completed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Completed
                </motion.span>
              ) : tx.status === "awaiting_payment" ? (
                <motion.span
                  key="awaiting_payment"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none" style={{ animationDuration: '2s' }} />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  Awaiting Payment
                </motion.span>
              ) : (
                <motion.span
                  key="pending"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Pending
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )}
      </TableCell>
      <TableCell className="text-center py-4 pr-4 sm:pr-6">
        {scheduled ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-4 text-xs font-medium rounded-lg border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all active:scale-95"
            data-testid={`button-cancel-${tx.id}`}
          >
            Cancel
          </Button>
        ) : (
          (() => {
            if (!isTerminal && !canCancel) {
              return <span className="text-gray-300 text-sm">—</span>;
            }
            return (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2">
                {isTerminal && (
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-8 w-full sm:w-auto px-4 text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
                    data-testid={`button-resend-${tx.id}`}
                  >
                    Resend
                  </Button>
                )}
                <AnimatePresence>
                  {canCancel && (
                    <motion.div
                      key={`cancel-btn-${tx.id}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.15 }}
                      className="w-full sm:w-auto"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-8 w-full sm:w-auto px-4 text-xs font-medium rounded-lg",
                          "text-red-500 border border-red-200 bg-white",
                          "hover:bg-red-50 hover:border-red-300 hover:text-red-600",
                          "active:bg-red-100 active:border-red-400",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400",
                          "transition-colors duration-150"
                        )}
                        aria-label={`Cancel transaction ${tx.id}`}
                        data-testid={`button-cancel-${tx.id}`}
                        onClick={() => onCancel(tx)}
                      >
                        Cancel
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()
        )}
      </TableCell>
    </TableRow>
  );
}

interface UnifiedRowProps {
  row: UnifiedTransactionRow;
  onView: (href: string) => void;
  onRequestDetails: (req: MoneyRequestView) => void;
  onRequestResend: (req: MoneyRequestView) => void;
  onRequestCopyLink: (req: MoneyRequestView) => void;
  onRequestCancel: (req: MoneyRequestView) => void;
  onInvoiceResend: (invoice: InvoiceListItem) => void;
  onInvoiceCancel: (invoice: InvoiceListItem) => void;
  resendingInvoiceId: string | null;
}

function UnifiedRow({
  row,
  onView,
  onRequestDetails,
  onRequestResend,
  onRequestCopyLink,
  onRequestCancel,
  onInvoiceResend,
  onInvoiceCancel,
  resendingInvoiceId,
}: UnifiedRowProps) {
  const badge = TYPE_BADGES[row.type];
  const req = row.moneyRequest;
  const invoice = row.invoice;
  // Ghost icon action for the money-request/invoice rows — the same compact
  // icon buttons the removed Money Requests / Sent Invoices pages used, so
  // their actions live on in this table.
  const iconAction = (
    title: string,
    testid: string,
    destructive: boolean,
    disabled: boolean,
    onClick: () => void,
    children: ReactNode,
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 w-8 p-0 transition-colors rounded-lg",
            destructive
              ? "text-red-600 hover:bg-red-50 hover:text-red-700"
              : "text-slate-500 hover:bg-blue-50 hover:text-blue-600",
          )}
          aria-label={title}
          data-testid={testid}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TableRow
      data-testid={`row-${row.type}-${row.ref}`}
      className="hover:bg-slate-50/80 transition-colors duration-150 group border-b border-slate-100 last:border-b-0"
    >
      <TableCell className="font-semibold text-blue-600 text-sm py-4 pl-4 sm:pl-6">
        <div className="font-mono text-[13px] tracking-tight">{row.ref}</div>
        <div className="text-xs font-bold text-gray-900 mt-0.5 sm:hidden">{row.amountLabel}</div>
      </TableCell>
      <TableCell className="text-sm font-medium text-gray-900 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-teal/10 text-teal font-semibold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {row.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-slate-900">{row.name}</div>
            {row.email ? <div className="text-xs text-slate-400 mt-0.5">{row.email}</div> : null}
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
              <span className={cn("w-1.5 h-1.5 rounded-full", badge.dot)} />
              {badge.label}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-gray-500 text-sm hidden md:table-cell py-4">
        <span className="inline-flex items-center text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
          {row.service}
        </span>
      </TableCell>
      <TableCell className="text-gray-500 text-sm hidden sm:table-cell py-4">
        <span className="text-xs text-slate-500 font-medium">{row.dateLabel}</span>
      </TableCell>
      <TableCell className="text-right font-bold text-gray-900 text-sm py-4 hidden sm:table-cell">
        <div className="flex items-center justify-end gap-1">
          <ArrowDownLeft className="w-3.5 h-3.5 text-teal-600" aria-hidden />
          <span className="font-semibold text-slate-900">{row.amountLabel}</span>
        </div>
        {row.subNote ? <div className="text-xs font-normal text-slate-400 mt-0.5">{row.subNote}</div> : null}
      </TableCell>
      <TableCell className="text-center py-4">
        <div className="flex items-center justify-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-2xs", row.statusClass)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", row.dotClass)} />
            {row.statusLabel}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center py-4 pr-4 sm:pr-6">
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-8 w-full sm:w-auto px-4 text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
            data-testid={`button-view-${row.ref}`}
            onClick={() => (req ? onRequestDetails(req) : onView(row.viewHref))}
          >
            View
          </Button>
          {req && moneyRequestAwaiting(req.status) &&
            iconAction("Resend email", `button-resend-${row.ref}`, false, false, () => onRequestResend(req), <Mail className="w-4 h-4" />)}
          {req && moneyRequestLinkShareable(req.status) &&
            iconAction("Copy payment link", `button-copy-link-${row.ref}`, false, false, () => onRequestCopyLink(req), <Copy className="w-4 h-4" />)}
          {req && moneyRequestAwaiting(req.status) &&
            iconAction("Cancel request", `button-cancel-${row.ref}`, true, false, () => onRequestCancel(req), <XCircle className="w-4 h-4" />)}
          {invoice && invoiceActionable(invoice.status) &&
            iconAction("Resend Notification", `button-resend-${row.ref}`, false, resendingInvoiceId === invoice.id, () => onInvoiceResend(invoice), <Mail className="w-4 h-4" />)}
          {invoice && invoiceActionable(invoice.status) &&
            iconAction("Cancel Invoice", `button-cancel-${row.ref}`, true, false, () => onInvoiceCancel(invoice), <XCircle className="w-4 h-4" />)}
          {invoice?.status === "expired" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-medium rounded-lg border-gray-200 hover:border-blue-300 hover:text-blue-600 active:scale-95"
              data-testid={`button-create-new-${row.ref}`}
              onClick={() => onView("/send-invoice")}
            >
              <FilePlus2 className="w-3.5 h-3.5 mr-1.5" />
              Create New Invoice
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const queryClient = useQueryClient();
  // Bonus State - Hardcoded for Prototype
  const [bonusBalance] = useState(5);
  const [cancelTarget, setCancelTarget] = useState<TransactionDetails | null>(null);
  // Money-request / invoice actions merged from the removed standalone pages.
  const [requestDetails, setRequestDetails] = useState<MoneyRequestView | null>(null);
  const [requestToCancel, setRequestToCancel] = useState<MoneyRequestView | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<InvoiceListItem | null>(null);
  const [resendingInvoiceId, setResendingInvoiceId] = useState<string | null>(null);
  const { toast } = useToast();

  // Unified Transactions table — server-backed money-in records (money
  // requests, invoices, campaigns) merged with the send-money prototype rows.
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const transactionsSectionRef = useRef<HTMLDivElement>(null);

  const requestsQuery = useQuery({
    queryKey: ["/api/request-money/requests"],
    queryFn: getRequests,
    refetchOnMount: "always",
    refetchInterval: 5000,
  });
  const sendMoneyQuery = useQuery({
    queryKey: ["/api/send-money/transactions"],
    queryFn: getSendMoneyTransactions,
    refetchOnMount: "always",
    refetchInterval: 5000,
  });
  const invoicesQuery = useQuery({
    queryKey: ["/api/invoices", "dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", invoiceListUrl({}));
      return ((await res.json()) as InvoiceListResponse).data;
    },
    refetchOnMount: "always",
    refetchInterval: 5000,
  });
  const campaignsQuery = useQuery({
    queryKey: ["/api/group-pay/campaigns"],
    queryFn: fetchCampaigns,
    refetchOnMount: "always",
    refetchInterval: 5000,
  });

  const mergedRows = useMemo<MergedRow[]>(() => {
    const sendRows: MergedRow[] = [
      ...(sendMoneyQuery.data ?? []).map(toSendMoneyRow).map((tx) => ({ kind: "send_money" as const, scheduled: false, dateSort: Date.parse(tx.date) || 0, tx })),
      ...scheduledTransactions.map((tx) => ({ kind: "send_money" as const, scheduled: true, dateSort: Date.parse(tx.date) || 0, tx })),
    ];
    const moneyInRows: MergedRow[] = [
      ...(requestsQuery.data ?? []).map(fromMoneyRequest),
      ...(invoicesQuery.data ?? []).map(fromInvoice),
      ...(campaignsQuery.data ?? []).map(fromCampaign),
    ].map((row) => ({ kind: row.type, dateSort: row.dateSort, row }));
    return [...sendRows, ...moneyInRows].sort((a, b) => b.dateSort - a.dateSort);
  }, [sendMoneyQuery.data, requestsQuery.data, invoicesQuery.data, campaignsQuery.data]);

  const searchLower = search.trim().toLowerCase();
  const searchedRows = useMemo(() => {
    if (!searchLower) return mergedRows;
    return mergedRows.filter((row) => {
      const fields =
        row.kind === "send_money"
          ? [row.tx.id, row.tx.recipient, row.tx.service, row.tx.amount]
          : [row.row.ref, row.row.name, row.row.email ?? "", row.row.service, row.row.amountLabel];
      return fields.some((value) => value.toLowerCase().includes(searchLower));
    });
  }, [mergedRows, searchLower]);

  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = { all: searchedRows.length, send_money: 0, receive_money: 0, invoice: 0, campaign: 0 };
    for (const row of searchedRows) counts[row.kind] += 1;
    return counts;
  }, [searchedRows]);

  const visibleRows = typeFilter === "all" ? searchedRows : searchedRows.filter((row) => row.kind === typeFilter);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / TRANSACTIONS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visibleRows.slice((safePage - 1) * TRANSACTIONS_PAGE_SIZE, safePage * TRANSACTIONS_PAGE_SIZE);
  const anyQueryLoading = requestsQuery.isLoading || invoicesQuery.isLoading || campaignsQuery.isLoading || sendMoneyQuery.isLoading;

  // Sidebar "Transactions" deep link (/?type=<filter>): apply the matching
  // type filter and center the transactions table in the viewport. Re-runs
  // on query changes, so it also works when the Dashboard is already open,
  // and waits for the table data so the centered position is final.
  useEffect(() => {
    const type = new URLSearchParams(searchParams).get("type");
    if (!TYPE_FILTERS.some((filter) => filter.value === type)) return;
    setTypeFilter(type as TypeFilter);
    setPage(1);
    if (anyQueryLoading) return;
    const timer = window.setTimeout(() => {
      transactionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchParams, anyQueryLoading]);

  const handleCancelClick = (tx: SendMoneyTx): void => {
    setCancelTarget({
      id: tx.id,
      recipient: tx.recipient,
      amount: tx.amount,
      service: tx.service,
    });
  };

  const handleCancelConfirm = async (transactionId: string): Promise<void> => {
    // Cancel the real server-owned transaction (the endpoint accepts the row
    // reference) — the bell notification is dispatched server-side with the
    // same payload shape this page used to send, and polling brings the
    // cancelled row back into the table.
    try {
      await cancelSendMoneyTransaction(transactionId);
    } catch {
      // Non-blocking — the table refreshes via polling either way.
    }
    setCancelTarget(null);
    void queryClient.invalidateQueries({ queryKey: ["/api/send-money/transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    toast({
      title: "Transaction cancelled",
      description: `Ref ${transactionId} has been cancelled successfully. A confirmation has been sent to your registered email address.`,
      duration: 6000,
    });
  };

  const handleCancelModalClose = (): void => {
    setCancelTarget(null);
  };

  // ── Money-request actions (ported from the removed /payment-requests page) ──
  const runRequestAction = async (action: string, fn: () => Promise<unknown>, successMessage: string) => {
    try {
      await fn();
      toast({ title: successMessage });
      void queryClient.invalidateQueries({ queryKey: ["/api/request-money/requests"] });
    } catch (err) {
      toast({
        title: `${action} failed`,
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResendRequestEmail = (req: MoneyRequestView): void => {
    void runRequestAction("Resend", () => resendEmail(req.id), "Email resent.");
  };

  const handleCopyRequestLink = (req: MoneyRequestView): void => {
    navigator.clipboard.writeText(req.checkoutUrl).then(
      () => toast({ title: "Link Copied!", description: "Payment link copied to clipboard — share it whenever you want." }),
      () => toast({ title: "Copy Failed", description: "Could not copy the link. Please try again.", variant: "destructive" })
    );
  };

  const handleRequestCancel = (req: MoneyRequestView): void => {
    setRequestDetails(null);
    setRequestToCancel(req);
  };

  const handleCancelRequestConfirm = async (req: MoneyRequestView): Promise<void> => {
    setRequestToCancel(null);
    await runRequestAction("Cancel", () => cancelRequest(req.id), "Money request cancelled successfully.");
  };

  // ── Invoice actions (ported from the removed /sent-invoices page) ──
  const handleInvoiceResend = async (invoice: InvoiceListItem): Promise<void> => {
    setResendingInvoiceId(invoice.id);
    try {
      await resendInvoiceNotificationRequest(invoice.id);
      toast({
        title: "Notification resent",
        description: `The invoice email was resent to ${invoice.clientEmail} using the same payment link.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    } catch (err) {
      toast({
        title: "Resend failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setResendingInvoiceId(null);
    }
  };

  const [copiedReferral, setCopiedReferral] = useState(false);
  const handleCopyReferral = () => {
    navigator.clipboard.writeText("rhemito.com/ref/OLAYINKA2025").then(
      () => {
        setCopiedReferral(true);
        toast({
          title: "Referral link copied!",
          description: "Share rhemito.com/ref/OLAYINKA2025 with friends to earn £10 bonus credit.",
        });
        setTimeout(() => setCopiedReferral(false), 2500);
      },
      () => {
        toast({
          title: "Copy failed",
          description: "Please copy rhemito.com/ref/OLAYINKA2025 manually.",
          variant: "destructive",
        });
      }
    );
  };

  return (
    <DashboardLayout>
      <CancelTransactionModal
        open={cancelTarget !== null}
        transaction={cancelTarget}
        onConfirm={handleCancelConfirm}
        onCancel={handleCancelModalClose}
      />
      <MoneyRequestDetailsDialog
        request={requestDetails}
        open={requestDetails !== null}
        onOpenChange={(open) => { if (!open) setRequestDetails(null); }}
        onResendEmail={handleResendRequestEmail}
        onCopyPaymentLink={handleCopyRequestLink}
        onCancelRequest={handleRequestCancel}
      />
      <CancelMoneyRequestDialog
        request={requestToCancel}
        open={requestToCancel !== null}
        onOpenChange={(open) => { if (!open) setRequestToCancel(null); }}
        onConfirm={handleCancelRequestConfirm}
      />
      <CancelInvoiceDialog
        invoice={invoiceToCancel}
        open={invoiceToCancel !== null}
        onOpenChange={(open) => { if (!open) setInvoiceToCancel(null); }}
      />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4 md:space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <motion.h1
              variants={itemVariants}
              className="text-xl md:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2"
            >
              Welcome Olayinka
              <span className="inline-block origin-[70%_70%] text-xl md:text-2xl">👋</span>
            </motion.h1>
            <motion.p variants={itemVariants} className="text-xs md:text-sm text-slate-500 mt-0.5">
              Overview of your money transfers, instant links, and accounts.
            </motion.p>
          </div>

          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.01, y: -1 }}
            className="flex items-center gap-2.5 bg-gradient-to-r from-purple-50 via-pink-50/70 to-purple-50 text-purple-700 px-3.5 py-2.5 sm:px-4 sm:py-2 rounded-2xl sm:rounded-full border border-purple-200/70 shadow-xs backdrop-blur-sm self-start md:self-auto max-w-full"
          >
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-xs shrink-0">
              <Gift className="w-3.5 h-3.5 text-pink-500" />
            </div>
            <span className="text-xs md:text-sm font-medium leading-snug">
              You have earned <span className="font-bold text-purple-900">£{bonusBalance.toFixed(2)} Referral Bonus Credit</span>. Create a Transaction to use it.
            </span>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
          <motion.div variants={itemVariants}>
            <Card className="h-full rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
              {/* Subtle background mesh gradient */}
              <div className="absolute top-0 right-0 w-[240px] h-[240px] bg-blue-50/60 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[180px] h-[180px] bg-teal/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

              <CardHeader className="pb-4 px-5 pt-5 relative z-10">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="tracking-tight">Quick Services</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5 pt-0 relative z-10">
                <motion.div whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="group w-full justify-start gap-3 sm:gap-3.5 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white min-h-[64px] sm:h-[70px] px-3.5 sm:px-4 py-2 text-sm sm:text-[15px] font-semibold rounded-xl shadow-sm hover:shadow-md hover:shadow-blue-500/15 transition-all duration-200 border-none"
                    onClick={() => setLocation("/send-money")}
                    data-testid="button-send-money"
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/20 shrink-0">
                      <Send className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 flex flex-col items-start gap-0.5 min-w-0">
                      <span className="leading-none text-white font-bold truncate max-w-full">Send Money</span>
                      <span className="text-[11px] sm:text-xs font-normal text-blue-100 truncate max-w-full">Transfer globally with live rates</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </div>
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="group w-full justify-start gap-3 sm:gap-3.5 bg-gradient-to-r from-teal to-emerald-600 hover:from-teal/90 hover:to-emerald-700 text-white min-h-[64px] sm:h-[70px] px-3.5 sm:px-4 py-2 text-sm sm:text-[15px] font-semibold rounded-xl shadow-sm hover:shadow-md hover:shadow-teal/15 transition-all duration-200 border-none"
                    onClick={() => setLocation("/request-payment")}
                    data-testid="button-request-payment"
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/20 shrink-0">
                      <Receipt className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 flex flex-col items-start gap-0.5 min-w-0">
                      <span className="leading-none text-white font-bold truncate max-w-full">Receive Money</span>
                      <span className="text-[11px] sm:text-xs font-normal text-teal-100 truncate max-w-full">Request instant payment link</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </div>
                  </Button>
                </motion.div>

                {/* Direct entries for the other get-paid services */}
                <div className="grid grid-cols-2 gap-3 pt-0.5">
                  <motion.div whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}>
                    <button
                      type="button"
                      onClick={() => setLocation("/send-invoice")}
                      className="group w-full h-[62px] flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-50/70 border border-slate-200/80 shadow-2xs hover:bg-white hover:border-indigo-300 hover:shadow-sm transition-all"
                      data-testid="button-send-invoice"
                    >
                      <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 leading-none text-center">
                        Send Invoice
                      </p>
                    </button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}>
                    <button
                      type="button"
                      onClick={() => setLocation("/group-pay/create")}
                      className="group w-full h-[62px] flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-50/70 border border-slate-200/80 shadow-2xs hover:bg-white hover:border-purple-300 hover:shadow-sm transition-all"
                      data-testid="button-funding-campaigns"
                    >
                      <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 leading-none text-center">
                        Funding Campaigns
                      </p>
                    </button>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-white shadow-[0_4px_24px_rgba(99,102,241,0.05)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.08)] transition-all duration-300 overflow-hidden relative flex flex-col justify-between">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-200/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-28 h-28 bg-purple-200/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl pointer-events-none" />

              <CardHeader className="pb-3 px-5 pt-5 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent tracking-tight">Refer & Earn</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-3 relative z-10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between bg-white/90 backdrop-blur-sm p-3.5 rounded-xl border border-indigo-100/80 shadow-2xs cursor-default hover:shadow-xs hover:border-indigo-200 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                          <Gift className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Bonus Credit</span>
                          <p className="text-xl font-extrabold text-slate-900">£{bonusBalance.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Ready to use
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a Transaction to redeem your Bonus Credit</p>
                  </TooltipContent>
                </Tooltip>

                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-semibold text-indigo-700">Invite friends</span> with your link and get <span className="font-bold text-emerald-600">£10 bonus credit</span> when they make their first transfer.
                </p>

                <div className="flex items-center gap-2 bg-white border border-indigo-200/70 rounded-xl p-2 sm:p-2.5 hover:border-indigo-400 transition-colors shadow-2xs min-w-0">
                  <div className="flex-1 min-w-0 truncate text-[11px] sm:text-xs font-mono font-semibold text-indigo-700 select-all pl-1">
                    rhemito.com/ref/OLAYINKA2025
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleCopyReferral}
                    className={cn(
                      "h-8 px-3 text-xs font-semibold shadow-xs transition-all active:scale-95",
                      copiedReferral
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    )}
                  >
                    {copiedReferral ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80 shadow-xs">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Account Summary</CardTitle>
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    #210145
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 px-5 pb-5 pt-0">
                {/* Sent Section */}
                <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <ArrowUpRight className="w-3.5 h-3.5 text-teal-600" />
                      <span>Sent</span>
                    </div>
                    <Select defaultValue="GBP">
                      <SelectTrigger className="h-6 w-[70px] text-[11px] bg-white border-slate-200 shadow-2xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-slate-400 font-medium">£</span>
                    <span className="text-base md:text-lg font-bold text-slate-900 tracking-tight">750,895.75</span>
                  </div>
                </div>

                {/* Wallet Section */}
                <div className="p-2.5 rounded-xl bg-blue-50/40 border border-blue-100/60 hover:border-blue-200/80 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                      <Wallet className="w-3.5 h-3.5 text-blue-600" />
                      <span>Wallet Balance</span>
                    </div>
                    <Select defaultValue="GBP">
                      <SelectTrigger className="h-6 w-[70px] text-[11px] bg-white border-blue-200/80 shadow-2xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-blue-400 font-medium">£</span>
                    <span className="text-base md:text-lg font-bold text-blue-700 tracking-tight">253,007.92</span>
                  </div>
                </div>

                {/* Collection Account Section */}
                <div className="p-2.5 rounded-xl bg-purple-50/40 border border-purple-100/60 hover:border-purple-200/80 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                      <Building2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>Collection Account</span>
                    </div>
                    <Select defaultValue="GBP">
                      <SelectTrigger className="h-6 w-[70px] text-[11px] bg-white border-purple-200/80 shadow-2xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-purple-400 font-medium">£</span>
                    <span className="text-base md:text-lg font-bold text-purple-800 tracking-tight">4,357,384.08</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={itemVariants} ref={transactionsSectionRef} data-testid="section-transactions">
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
            <CardContent className="p-0">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 md:px-6 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/60 to-white">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display font-bold text-base md:text-lg text-slate-900 tracking-tight">Transactions</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
                      {visibleRows.length} total
                    </span>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by ref, name, email or service…"
                      className="pl-9 pr-8 h-9 text-xs rounded-xl bg-white border-slate-200 shadow-2xs focus-visible:ring-blue-500"
                      data-testid="input-search-transactions"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setPage(1);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/40 overflow-x-auto no-scrollbar scroll-smooth">
                  {TYPE_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => {
                        setTypeFilter(filter.value);
                        setPage(1);
                      }}
                      data-testid={`chip-type-${filter.value.replace(/_/g, "-")}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 shrink-0 whitespace-nowrap",
                        typeFilter === filter.value
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20"
                          : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600 shadow-2xs"
                      )}
                    >
                      {filter.label}
                      <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", typeFilter === filter.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                        {typeCounts[filter.value]}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto" data-testid="table-transactions">
                  <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-slate-50/80 border-b border-slate-100">
                          <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[90px] sm:w-[130px] py-3.5 pl-4 sm:pl-6">Ref No.</TableHead>
                          <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-3.5">Recipient / Sender</TableHead>
                          <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell py-3.5">Service</TableHead>
                          <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell py-3.5">Date</TableHead>
                          <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right py-3.5 hidden sm:table-cell">Amount</TableHead>
                          <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center py-3.5">Status</TableHead>
                          <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center py-3.5">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleRows.length === 0 && !anyQueryLoading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-14 text-center text-sm text-slate-400" data-testid="empty-transactions">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                                  <Search className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-slate-600">No transactions match your search or filters.</span>
                                {(search || typeFilter !== "all") && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-xs mt-1 rounded-lg"
                                    onClick={() => {
                                      setSearch("");
                                      setTypeFilter("all");
                                      setPage(1);
                                    }}
                                  >
                                    Reset filters
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          pageRows.map((row) =>
                            row.kind === "send_money" ? (
                              <SendMoneyRow key={row.tx.id} tx={row.tx} scheduled={row.scheduled} onCancel={handleCancelClick} />
                            ) : (
                              <UnifiedRow
                                key={row.row.key}
                                row={row.row}
                                onView={setLocation}
                                onRequestDetails={setRequestDetails}
                                onRequestResend={handleResendRequestEmail}
                                onRequestCopyLink={handleCopyRequestLink}
                                onRequestCancel={handleRequestCancel}
                                onInvoiceResend={handleInvoiceResend}
                                onInvoiceCancel={setInvoiceToCancel}
                                resendingInvoiceId={resendingInvoiceId}
                              />
                            )
                          )
                        )}
                        {anyQueryLoading && (
                          <TableRow>
                            <TableCell colSpan={7} className="py-4">
                              <Skeleton className="h-9 w-full rounded-lg" />
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {visibleRows.length > 0 && (
                    <div
                      className="flex flex-col sm:flex-row items-center justify-between gap-2 px-5 md:px-6 py-3.5 border-t border-slate-100 bg-slate-50/30"
                      data-testid="transactions-pagination"
                    >
                      <p className="text-xs text-slate-500 font-medium">
                        Showing {Math.min(visibleRows.length, (safePage - 1) * TRANSACTIONS_PAGE_SIZE + 1)}–{Math.min(safePage * TRANSACTIONS_PAGE_SIZE, visibleRows.length)} of {visibleRows.length} transactions • Page {safePage} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="h-8 px-3 text-xs rounded-lg border-slate-200 hover:bg-white active:scale-95"
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="h-8 px-3 text-xs rounded-lg border-slate-200 hover:bg-white active:scale-95"
                          data-testid="button-next-page"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
