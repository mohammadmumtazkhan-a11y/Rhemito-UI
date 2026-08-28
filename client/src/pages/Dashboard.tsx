import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Receipt, ArrowRight, Gift, Copy, Sparkles, Search, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { RequestPaymentModal } from "@/components/RequestPaymentModal";
import { CancelTransactionModal, type TransactionDetails } from "@/components/CancelTransactionModal";
import { getRequests } from "@/lib/requests";
import { invoiceListUrl, type InvoiceListResponse } from "@/lib/invoices";
import { fetchCampaigns } from "@/lib/groupPay";
import { cancelSendMoneyTransaction, getSendMoneyTransactions, toSendMoneyRow } from "@/lib/sendMoney";
import {
  TYPE_BADGES,
  fromCampaign,
  fromInvoice,
  fromMoneyRequest,
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
        "hover:bg-blue-50/50 transition-colors duration-200 group border-b border-gray-50 last:border-b-0",
        tx.status === "awaiting_payment" && "border-l-2 border-l-amber-400"
      )}
    >
      <TableCell className="font-semibold text-blue-600 text-sm py-4 pl-4 sm:pl-6">
        <div>{tx.id}</div>
        <div className="text-xs font-bold text-gray-900 mt-0.5 sm:hidden">{tx.amount}</div>
      </TableCell>
      <TableCell className="text-sm font-medium text-gray-900 py-4">
        <div>{tx.recipient}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-gray-500">
          <span className={cn("w-1.5 h-1.5 rounded-full", TYPE_BADGES.send_money.dot)} />
          {TYPE_BADGES.send_money.label}
        </div>
      </TableCell>
      <TableCell className="text-gray-500 text-sm hidden md:table-cell py-4">{tx.service}</TableCell>
      <TableCell className="text-gray-500 text-sm hidden sm:table-cell py-4">{tx.date}</TableCell>
      <TableCell className="text-right font-bold text-gray-900 text-sm py-4 hidden sm:table-cell">
        <div className="flex items-center justify-end gap-1">
          <ArrowUpRight className="w-3.5 h-3.5 text-gray-400" aria-hidden />
          {tx.amount}
        </div>
      </TableCell>
      <TableCell className="text-center py-4">
        {scheduled ? (
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Cancelled
                </motion.span>
              ) : tx.status === "completed" ? (
                <motion.span
                  key="completed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Completed
                </motion.span>
              ) : tx.status === "awaiting_payment" ? (
                <motion.span
                  key="awaiting_payment"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
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
            className="h-8 px-4 text-xs font-medium rounded-lg border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
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
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-8 w-full sm:w-auto px-4 text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
                    data-testid={`button-resend-${tx.id}`}
                  >
                    Resend
                  </Button>
                )}
                <AnimatePresence>
                  {canCancel && (
                    <motion.div
                      key={`cancel-btn-${tx.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-full sm:w-auto"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-8 w-full sm:w-auto px-4 text-xs font-medium rounded-full",
                          "text-red-500 border border-red-200 bg-transparent",
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

function UnifiedRow({ row, onView }: { row: UnifiedTransactionRow; onView: (href: string) => void }) {
  const badge = TYPE_BADGES[row.type];
  return (
    <TableRow
      data-testid={`row-${row.type}-${row.ref}`}
      className="hover:bg-blue-50/50 transition-colors duration-200 group border-b border-gray-50 last:border-b-0"
    >
      <TableCell className="font-semibold text-blue-600 text-sm py-4 pl-4 sm:pl-6">
        <div>{row.ref}</div>
        <div className="text-xs font-bold text-gray-900 mt-0.5 sm:hidden">{row.amountLabel}</div>
      </TableCell>
      <TableCell className="text-sm font-medium text-gray-900 py-4">
        <div>{row.name}</div>
        {row.email ? <div className="text-xs text-gray-400 mt-0.5">{row.email}</div> : null}
        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-gray-500">
          <span className={cn("w-1.5 h-1.5 rounded-full", badge.dot)} />
          {badge.label}
        </div>
      </TableCell>
      <TableCell className="text-gray-500 text-sm hidden md:table-cell py-4">{row.service}</TableCell>
      <TableCell className="text-gray-500 text-sm hidden sm:table-cell py-4">{row.dateLabel}</TableCell>
      <TableCell className="text-right font-bold text-gray-900 text-sm py-4 hidden sm:table-cell">
        <div className="flex items-center justify-end gap-1">
          <ArrowDownLeft className="w-3.5 h-3.5 text-teal-500" aria-hidden />
          {row.amountLabel}
        </div>
        {row.subNote ? <div className="text-xs font-normal text-gray-400 mt-0.5">{row.subNote}</div> : null}
      </TableCell>
      <TableCell className="text-center py-4">
        <div className="flex items-center justify-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", row.statusClass)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", row.dotClass)} />
            {row.statusLabel}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center py-4 pr-4 sm:pr-6">
        <Button
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-8 w-full sm:w-auto px-4 text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
          data-testid={`button-view-${row.ref}`}
          onClick={() => onView(row.viewHref)}
        >
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  // Bonus State - Hardcoded for Prototype
  const [bonusBalance] = useState(5);
  const [cancelTarget, setCancelTarget] = useState<TransactionDetails | null>(null);
  const { toast } = useToast();

  // Unified Transactions table — server-backed money-in records (money
  // requests, invoices, campaigns) merged with the send-money prototype rows.
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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

  const handlePaymentOptionSelect = (option: "request" | "invoice" | "funding") => {
    setShowPaymentModal(false);
    switch (option) {
      case "request":
        setLocation("/request-payment");
        break;
      case "invoice":
        setLocation("/send-invoice");
        break;
      case "funding":
        setLocation("/group-pay/create");
        break;
    }
  };

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

  return (
    <DashboardLayout>
      <RequestPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        onSelect={handlePaymentOptionSelect}
      />
      <CancelTransactionModal
        open={cancelTarget !== null}
        transaction={cancelTarget}
        onConfirm={handleCancelConfirm}
        onCancel={handleCancelModalClose}
      />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4 md:space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.h1
            variants={itemVariants}
            className="text-xl md:text-2xl font-semibold font-display"
          >
            Welcome Olayinka
          </motion.h1>

          <motion.div
            variants={itemVariants}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-50 to-purple-50 text-purple-700 px-4 py-2 rounded-full border border-purple-100 shadow-sm"
          >
            <div className="bg-white p-1 rounded-full shadow-sm">
              <Gift className="w-4 h-4 text-pink-500" />
            </div>
            <span className="text-xs md:text-sm font-medium">
              You have earned <span className="font-bold">£{bonusBalance.toFixed(2)} Referral Bonus Credit</span>. Create a Transaction to use it.
            </span>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
          <motion.div variants={itemVariants}>
            <Card className="h-full bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-500 relative overflow-hidden">
              {/* Subtle background mesh gradient for premium feel */}
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-60" />
              <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-50/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 opacity-60" />

              <CardHeader className="pb-6 px-7 pt-7 relative z-10">
                <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-2xl bg-white shadow-sm border border-slate-100 text-indigo-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="tracking-tight">Quick Services</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-7 pb-8 relative z-10">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="group w-full justify-start gap-4 bg-blue-600 hover:bg-blue-700 text-white h-[72px] text-[15px] font-semibold rounded-2xl shadow-md hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 border-none"
                    onClick={() => setLocation("/send-money")}
                    data-testid="button-send-money"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <Send className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 flex flex-col items-start gap-0.5">
                      <span className="leading-none text-white">Send Money</span>
                      <span className="text-xs font-normal text-blue-100">Transfer globally</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </div>
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="group w-full justify-start gap-4 bg-[#1FC0A6] hover:bg-[#19a58e] text-white h-[72px] text-[15px] font-semibold rounded-2xl shadow-md hover:shadow-xl hover:shadow-teal-500/20 transition-all duration-300 border-none"
                    onClick={() => setShowPaymentModal(true)}
                    data-testid="button-request-payment"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <Receipt className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 flex flex-col items-start gap-0.5">
                      <span className="leading-none text-white">Receive Money</span>
                      <span className="text-xs font-normal text-teal-50">Get paid fast</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </div>
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50 border-indigo-100/50 shadow-lg shadow-indigo-100/30 overflow-hidden relative">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-violet-200/30 to-pink-200/30 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

              <CardHeader className="pb-2 px-4 md:px-6 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-300/50">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-sm md:text-base font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">Refer & Earn</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 md:px-6 space-y-4 relative z-10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-indigo-200/50 shadow-inner cursor-default hover:shadow-md hover:border-indigo-300/70 transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-md">
                          <Gift className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bonus Credit</span>
                          <p className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">£{bonusBalance.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Ready to use</span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a Transaction to redeem your Bonus Credit</p>
                  </TooltipContent>
                </Tooltip>

                <p className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold text-indigo-700">Invite friends</span> with your link and get <span className="font-bold text-emerald-600">£10 bonus credit</span> when they join and make their first transfer.
                </p>

                <div className="flex items-center gap-2 bg-white border-2 border-dashed border-indigo-200 rounded-xl p-3 hover:border-indigo-400 transition-colors group">
                  <div className="flex-1 truncate text-sm font-mono font-medium text-indigo-600 select-all">
                    rhemito.com/ref/OLAYINKA2025
                  </div>
                  <Button size="sm" className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all">
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full">
              <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
                <CardTitle className="text-sm md:text-base font-semibold text-blue-600">Account Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 md:px-6">
                {/* Account Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Account</span>
                    <span className="text-sm">210145</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sent</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-teal">750895.75</span>
                      <Select defaultValue="GBP">
                        <SelectTrigger className="h-7 w-[75px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Wallet Section */}
                <div className="space-y-3">
                  <div className="font-semibold text-sm">Wallet</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-600">253007.92</span>
                      <Select defaultValue="GBP">
                        <SelectTrigger className="h-7 w-[75px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Collection Account Section */}
                <div className="space-y-3">
                  <div className="font-semibold text-sm">Collection Account</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-600">4357384.08</span>
                      <Select defaultValue="GBP">
                        <SelectTrigger className="h-7 w-[75px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={itemVariants}>
          <Card className="border-gray-100/80 shadow-xl shadow-gray-100/50 overflow-hidden">
            <CardContent className="p-0">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-6 pt-4 md:pt-5 pb-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
                  <h2 className="font-display font-semibold text-sm md:text-base text-gray-900">Transactions</h2>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by ref, name, email or service…"
                      className="pl-9 h-9 text-sm rounded-lg bg-white"
                      data-testid="input-search-transactions"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3 border-b border-gray-100 bg-gray-50/30">
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
                        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all",
                        typeFilter === filter.value
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                      )}
                    >
                      {filter.label}
                      <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", typeFilter === filter.value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>
                        {typeCounts[filter.value]}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto" data-testid="table-transactions">
                  <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-gray-50/50 border-b border-gray-100">
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-[90px] sm:w-[130px] py-4 pl-4 sm:pl-6">Ref No.</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-4">Recipient / Sender</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell py-4">Service</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell py-4">Date</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right py-4 hidden sm:table-cell">Amount</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center py-4">Status</TableHead>
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center py-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleRows.length === 0 && !anyQueryLoading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center text-sm text-gray-400" data-testid="empty-transactions">
                              No transactions match your search or filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          pageRows.map((row) =>
                            row.kind === "send_money" ? (
                              <SendMoneyRow key={row.tx.id} tx={row.tx} scheduled={row.scheduled} onCancel={handleCancelClick} />
                            ) : (
                              <UnifiedRow key={row.row.key} row={row.row} onView={setLocation} />
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
                      className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 md:px-6 py-3 border-t border-gray-100"
                      data-testid="transactions-pagination"
                    >
                      <p className="text-xs text-gray-500">
                        Showing {Math.min(visibleRows.length, (safePage - 1) * TRANSACTIONS_PAGE_SIZE + 1)}–{Math.min(safePage * TRANSACTIONS_PAGE_SIZE, visibleRows.length)} of {visibleRows.length} transactions • Page {safePage} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
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
