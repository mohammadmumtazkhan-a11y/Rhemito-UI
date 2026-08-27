/**
 * Unified Transactions mapping — normalises the three server-backed money-in
 * record types (money requests, invoices, funding campaigns) into the row
 * shape the Dashboard transactions table renders alongside the send-money
 * prototype rows. Labels and pill styles mirror each record's dedicated page
 * so the unified table never reinterprets a status.
 */

import { CURRENCY_SYMBOLS } from "@shared/currencies";
import { formatShortDate } from "@shared/invoice-logic";
import type { MoneyRequestView } from "@/lib/requests";
import type { InvoiceListItem } from "@/lib/invoices";
import type { CampaignWithSummary } from "@/lib/groupPay";

export type TransactionType = "send_money" | "receive_money" | "invoice" | "campaign";

export interface UnifiedTransactionRow {
  key: string;
  type: Exclude<TransactionType, "send_money">;
  ref: string;
  name: string;
  email: string | null;
  service: string;
  dateLabel: string;
  dateSort: number;
  amountLabel: string;
  subNote: string | null;
  statusLabel: string;
  statusClass: string;
  dotClass: string;
  viewHref: string;
}

/** Compact type badge shown under the counterparty name in the unified table. */
export const TYPE_BADGES: Record<TransactionType, { label: string; dot: string }> = {
  send_money: { label: "Send Money", dot: "bg-blue-500" },
  receive_money: { label: "Receive Money", dot: "bg-teal-500" },
  invoice: { label: "Invoice", dot: "bg-purple-500" },
  campaign: { label: "Campaign", dot: "bg-indigo-500" },
};

// Mirrors PaymentRequests.tsx STATUS_LABELS / STATUS_STYLES (plus dot colours).
const REQUEST_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  active: { label: "Sent", pill: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  viewed: { label: "Viewed", pill: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  authorisation_in_progress: { label: "Authorisation in Progress", pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  payment_processing: { label: "Payment Processing", pill: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  payment_pending: { label: "Payment Pending", pill: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  funded: { label: "Funded", pill: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  payout_pending: { label: "Paying Out", pill: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  paid_out: { label: "Paid Out", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  failed: { label: "Failed", pill: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  expired: { label: "Expired", pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  cancelled: { label: "Cancelled", pill: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
  refunded: { label: "Refunded", pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

// Mirrors components/invoices/InvoiceStatusBadge.tsx.
const INVOICE_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  sent: { label: "Sent", pill: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  overdue: { label: "Overdue", pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  payment_processing: { label: "Payment Processing", pill: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  paid: { label: "Paid", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  expired: { label: "Expired", pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  cancelled: { label: "Cancelled", pill: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

// Mirrors the GroupPayDashboard status pill colours.
const CAMPAIGN_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  active: { label: "Active", pill: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
  completed: { label: "Completed", pill: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  paused: { label: "Paused", pill: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  cancelled: { label: "Cancelled", pill: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-400" },
};

const FALLBACK_STATUS = { label: "", pill: "bg-gray-50 text-gray-600 border-gray-200", dot: "bg-gray-400" };

function toDisplayDate(iso: string | null): { label: string; sort: number } {
  if (!iso) return { label: "—", sort: 0 };
  const sort = Date.parse(iso);
  return { label: formatShortDate(iso.slice(0, 10)), sort: Number.isNaN(sort) ? 0 : sort };
}

export function fromMoneyRequest(req: MoneyRequestView): UnifiedTransactionRow {
  const status = REQUEST_STATUS[req.status] ?? { ...FALLBACK_STATUS, label: req.status };
  return {
    key: `receive_money-${req.requestNumber}`,
    type: "receive_money",
    ref: req.requestNumber,
    name: req.senderName,
    email: req.senderEmail,
    service: "Money Request",
    dateLabel: toDisplayDate(req.createdAt).label,
    dateSort: toDisplayDate(req.createdAt).sort,
    amountLabel: `${CURRENCY_SYMBOLS[req.payoutCurrency] ?? ""}${req.payoutAmount ?? req.payInAmount} ${req.payoutCurrency}`,
    subNote: req.feeAmount
      ? req.absorbFee
        ? `after ${req.feeAmount} fee`
        : `${req.feeAmount} fee charged to sender`
      : null,
    statusLabel: status.label,
    statusClass: status.pill,
    dotClass: status.dot,
    viewHref: "/payment-requests",
  };
}

export function fromInvoice(inv: InvoiceListItem): UnifiedTransactionRow {
  const status = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.sent;
  const sent = toDisplayDate(inv.sentAt);
  return {
    key: `invoice-${inv.invoiceNumber}`,
    type: "invoice",
    ref: inv.invoiceNumber,
    name: inv.clientName,
    email: inv.clientEmail,
    service: "Invoice",
    dateLabel: sent.label,
    dateSort: sent.sort,
    amountLabel: `${CURRENCY_SYMBOLS[inv.currency] ?? ""}${inv.fees.invoiceAmount.toFixed(2)} ${inv.currency}`,
    subNote: inv.dueDate ? `Due ${formatShortDate(inv.dueDate.slice(0, 10))}` : null,
    statusLabel: status.label,
    statusClass: status.pill,
    dotClass: status.dot,
    viewHref: `/sent-invoices/${inv.id}`,
  };
}

export function fromCampaign(c: CampaignWithSummary): UnifiedTransactionRow {
  const status = CAMPAIGN_STATUS[c.status] ?? { ...FALLBACK_STATUS, label: c.status.charAt(0).toUpperCase() + c.status.slice(1) };
  const created = toDisplayDate(c.createdAt.toISOString());
  const raisedPct = c.targetAmount > 0 ? Math.min(100, Math.round((c.summary.totalRaised / c.targetAmount) * 100)) : 0;
  return {
    key: `campaign-${c.id}`,
    type: "campaign",
    ref: c.id.slice(0, 8),
    name: c.name,
    email: null,
    service: "Funding Campaign",
    dateLabel: created.label,
    dateSort: created.sort,
    // targetAmount is stored as the raw fee-inclusive float computed at
    // creation (e.g. 102.87179487179488) — always render money at 2dp.
    amountLabel: `${CURRENCY_SYMBOLS[c.currency] ?? ""}${c.targetAmount.toFixed(2)} ${c.currency}`,
    subNote: `${raisedPct}% raised · ${c.summary.contributorCount} contributor${c.summary.contributorCount === 1 ? "" : "s"}`,
    statusLabel: status.label,
    statusClass: status.pill,
    dotClass: status.dot,
    viewHref: `/group-pay/${c.id}`,
  };
}
