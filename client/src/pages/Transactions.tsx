import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Mail,
  XCircle,
  Copy,
  FilePlus2,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface SendMoneyTx {
  id: string;
  recipient: string;
  service: string;
  date: string;
  amount: string;
  status: string;
}

type TypeFilter = "all" | TransactionType;

const TRANSACTIONS_PAGE_SIZE = 20;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "send_money", label: "Send Money" },
  { value: "receive_money", label: "Receive Money" },
  { value: "invoice", label: "Invoices" },
  { value: "campaign", label: "Campaigns" },
];

type MergedRow =
  | { kind: "send_money"; scheduled: boolean; dateSort: number; tx: SendMoneyTx }
  | { kind: "receive_money" | "invoice" | "campaign"; dateSort: number; row: UnifiedTransactionRow };

function SendMoneyRow({ tx, scheduled, onCancel }: { tx: SendMoneyTx; scheduled: boolean; onCancel: (tx: SendMoneyTx) => void }) {
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
            "h-8 w-8 p-0 transition-colors",
            destructive
              ? "text-red-600 hover:bg-red-50 hover:text-red-700"
              : "text-gray-500 hover:bg-blue-50 hover:text-blue-600",
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
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-8 w-full sm:w-auto px-4 text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
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
              className="h-8 px-3 text-xs font-medium rounded-lg border-gray-200 hover:border-blue-300 hover:text-blue-600"
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

function MobileSendMoneyCard({
  tx,
  scheduled,
  onCancel,
}: {
  tx: SendMoneyTx;
  scheduled?: boolean;
  onCancel: (tx: SendMoneyTx) => void;
}) {
  const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;
  const isTerminal = (TERMINAL_STATUSES as readonly string[]).includes(tx.status);
  const canCancel = tx.status === "awaiting_payment";

  return (
    <div
      data-testid={scheduled ? `row-scheduled-${tx.id}` : `row-transaction-${tx.id}`}
      className={cn(
        "p-4 rounded-2xl bg-white transition-all my-2 border border-slate-200/80 shadow-2xs hover:shadow-xs space-y-3",
        tx.status === "awaiting_payment" && "border-l-4 border-l-amber-400 bg-amber-50/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-blue-100/80 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {tx.recipient.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900 text-sm truncate">{tx.recipient}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                <span className={cn("w-1.5 h-1.5 rounded-full", TYPE_BADGES.send_money.dot)} />
                {TYPE_BADGES.send_money.label}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-[11px] text-blue-600 font-semibold">{tx.id}</span>
              {tx.date && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] text-slate-400">{tx.date}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <span className="font-bold text-base text-slate-900 tracking-tight whitespace-nowrap">
            {tx.amount}
          </span>
          {scheduled ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Scheduled
            </span>
          ) : tx.status === "cancelled" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Cancelled
            </span>
          ) : tx.status === "completed" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Completed
            </span>
          ) : tx.status === "awaiting_payment" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              Awaiting Payment
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Pending
            </span>
          )}
        </div>
      </div>

      {(scheduled || isTerminal || canCancel) && (
        <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 justify-end">
          {scheduled ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-4 text-xs font-medium rounded-lg border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all w-full"
              data-testid={`button-cancel-${tx.id}`}
            >
              Cancel
            </Button>
          ) : (
            <>
              {isTerminal && (
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-8 flex-1 text-xs font-medium rounded-lg shadow-sm transition-all active:scale-95"
                  data-testid={`button-resend-${tx.id}`}
                >
                  Resend
                </Button>
              )}
              {canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 text-xs font-medium rounded-lg text-red-500 border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 hover:text-red-600 active:scale-95 transition-all"
                  data-testid={`button-cancel-${tx.id}`}
                  onClick={() => onCancel(tx)}
                >
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MobileUnifiedCard({
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

  return (
    <div
      data-testid={`row-${row.type}-${row.ref}`}
      className="p-4 rounded-2xl bg-white transition-all my-2 border border-slate-200/80 shadow-2xs hover:shadow-xs space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-teal/10 text-teal font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {row.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900 text-sm truncate">{row.name}</div>
            {row.email ? <div className="text-xs text-slate-400 truncate">{row.email}</div> : null}
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                <span className={cn("w-1.5 h-1.5 rounded-full", badge.dot)} />
                {badge.label}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-[11px] text-blue-600 font-semibold">{row.ref}</span>
              {row.dateLabel && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] text-slate-400">{row.dateLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <span className="font-bold text-base text-slate-900 tracking-tight whitespace-nowrap">
            {row.amountLabel}
          </span>
          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border shadow-2xs", row.statusClass)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", row.dotClass)} />
            {row.statusLabel}
          </span>
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap justify-end">
        <Button
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-8 px-4 text-xs font-medium rounded-lg shadow-sm transition-all active:scale-95"
          data-testid={`button-view-${row.ref}`}
          onClick={() => (req ? onRequestDetails(req) : onView(row.viewHref))}
        >
          View
        </Button>

        {req && moneyRequestAwaiting(req.status) && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-50 border-slate-200 active:scale-95"
            data-testid={`button-resend-${row.ref}`}
            onClick={() => onRequestResend(req)}
          >
            <Mail className="w-3.5 h-3.5 mr-1" />
            Resend
          </Button>
        )}

        {req && moneyRequestLinkShareable(req.status) && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs font-medium rounded-lg text-blue-600 hover:bg-blue-50 border-blue-200 active:scale-95"
            data-testid={`button-copy-link-${row.ref}`}
            onClick={() => onRequestCopyLink(req)}
          >
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copy Link
          </Button>
        )}

        {req && moneyRequestAwaiting(req.status) && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 border-red-200 active:scale-95"
            data-testid={`button-cancel-${row.ref}`}
            onClick={() => onRequestCancel(req)}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
        )}

        {invoice && invoiceActionable(invoice.status) && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-50 border-slate-200 active:scale-95"
            data-testid={`button-resend-${row.ref}`}
            disabled={resendingInvoiceId === invoice.id}
            onClick={() => onInvoiceResend(invoice)}
          >
            <Mail className="w-3.5 h-3.5 mr-1" />
            Resend
          </Button>
        )}

        {invoice && invoiceActionable(invoice.status) && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 border-red-200 active:scale-95"
            data-testid={`button-cancel-${row.ref}`}
            onClick={() => onInvoiceCancel(invoice)}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
        )}

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
    </div>
  );
}

export default function Transactions() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [cancelTarget, setCancelTarget] = useState<TransactionDetails | null>(null);
  const [requestDetails, setRequestDetails] = useState<MoneyRequestView | null>(null);
  const [requestToCancel, setRequestToCancel] = useState<MoneyRequestView | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<InvoiceListItem | null>(null);
  const [resendingInvoiceId, setResendingInvoiceId] = useState<string | null>(null);

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
    queryKey: ["/api/invoices", "transactions"],
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

  useEffect(() => {
    const type = new URLSearchParams(searchParams).get("type");
    if (!TYPE_FILTERS.some((filter) => filter.value === type)) return;
    setTypeFilter(type as TypeFilter);
    setPage(1);
  }, [searchParams]);

  const handleCancelClick = (tx: SendMoneyTx): void => {
    setCancelTarget({
      id: tx.id,
      recipient: tx.recipient,
      amount: tx.amount,
      service: tx.service,
    });
  };

  const handleCancelConfirm = async (transactionId: string): Promise<void> => {
    try {
      await cancelSendMoneyTransaction(transactionId);
    } catch {
      // Non-blocking
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

      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          data-testid="section-transactions-page"
        >
          <Card className="border-gray-100/80 shadow-xl shadow-gray-100/50 overflow-hidden bg-white">
            <CardContent className="p-0">
              <div>
                {/* Header with Title and Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-6 pt-5 md:pt-6 pb-4 border-b border-gray-100 bg-white">
                  <h1 className="font-display font-bold text-lg md:text-xl text-gray-900">Transactions</h1>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by ref, name, email or service…"
                      className="pl-9 h-10 text-sm rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                      data-testid="input-search-transactions"
                    />
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3.5 border-b border-gray-100 bg-gray-50/30">
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
                        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-150",
                        typeFilter === filter.value
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                      )}
                    >
                      {filter.label}
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        typeFilter === filter.value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                      )}>
                        {typeCounts[filter.value]}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto" data-testid="table-transactions">
                  {isMobile ? (
                    <div className="p-3 space-y-2">
                      {visibleRows.length === 0 && !anyQueryLoading ? (
                        <div className="py-16 text-center text-sm text-gray-400" data-testid="empty-transactions">
                          No transactions match your search or filters.
                        </div>
                      ) : (
                        pageRows.map((row) =>
                          row.kind === "send_money" ? (
                            <MobileSendMoneyCard key={row.tx.id} tx={row.tx} scheduled={row.scheduled} onCancel={handleCancelClick} />
                          ) : (
                            <MobileUnifiedCard
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
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-gray-50/50 border-b border-gray-100">
                          <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-[100px] sm:w-[150px] py-4 pl-4 sm:pl-6">Ref No.</TableHead>
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
                            <TableCell colSpan={7} className="py-16 text-center text-sm text-gray-400" data-testid="empty-transactions">
                              No transactions match your search or filters.
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
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Pagination footer */}
                {visibleRows.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 md:px-6 py-4 border-t border-gray-100 bg-white text-xs text-gray-500">
                    <div>
                      Showing {(safePage - 1) * TRANSACTIONS_PAGE_SIZE + 1} to {Math.min(safePage * TRANSACTIONS_PAGE_SIZE, visibleRows.length)} of {visibleRows.length} transactions
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="h-8 px-2.5 text-xs rounded-lg"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                          Previous
                        </Button>
                        <span className="px-2 font-medium text-gray-700">
                          {safePage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="h-8 px-2.5 text-xs rounded-lg"
                        >
                          Next
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
