/**
 * Send Money API client — the server-owned transaction store behind the
 * wizard and the Dashboard unified Transactions table.
 */

import { apiRequest } from "@/lib/queryClient";
import { formatShortDate } from "@shared/invoice-logic";
import type { SendMoneyPaymentMethod, SendMoneyService, SendMoneyTransactionView } from "@shared/sendMoney";

export interface CreateSendMoneyInput {
  recipientName: string;
  service: SendMoneyService;
  sendCurrency: string;
  sendAmount: string;
  receiveCurrency: string;
  receiveAmount: string;
  fee: string;
  exchangeRate: string;
  promoCode?: string;
  /** Fee before the promo discount (the server re-checks the discount when the transfer is paid). */
  feeBeforePromo?: string;
}

export async function createSendMoneyTransaction(input: CreateSendMoneyInput): Promise<SendMoneyTransactionView> {
  const res = await apiRequest("POST", "/api/send-money/transactions", input);
  return ((await res.json()) as { data: SendMoneyTransactionView }).data;
}

export async function getSendMoneyTransactions(): Promise<SendMoneyTransactionView[]> {
  const res = await apiRequest("GET", "/api/send-money/transactions");
  return ((await res.json()) as { data: SendMoneyTransactionView[] }).data;
}

/** A Send Money API error with its machine code (e.g. PROMO_REJECTED, PROMO_CHANGED). */
export class SendMoneyApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Pay a transaction. A promo code applied on the payment step travels with the request, together with the
 * discount the customer was shown, so the server can re-check and record it before any money moves (PROMO-RHEMITO P-20).
 */
export async function paySendMoneyTransaction(
  id: string,
  paymentMethod: SendMoneyPaymentMethod,
  promo?: { code: string; discount: number } | null,
  bonus?: { mode: "pay_less" | "send_more"; amount: number } | null,
): Promise<SendMoneyTransactionView> {
  const body: Record<string, unknown> = { paymentMethod };
  // Bonus credit travels with the payment so the server re-checks and uses it before any money moves (BONUS-RHEMITO B-20)
  if (bonus && bonus.amount > 0) body.bonusCredit = { mode: bonus.mode, amount: bonus.amount.toFixed(2) };
  if (promo?.code) {
    body.promoCode = promo.code;
    body.promoDiscount = Math.max(0, promo.discount).toFixed(2);
  }
  const res = await fetch(`/api/send-money/transactions/${encodeURIComponent(id)}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new SendMoneyApiError(res.status, String(json?.error?.code ?? "PAY_FAILED"), String(json?.error?.message ?? "The payment could not be recorded. Please try again."));
  }
  return (json as { data: SendMoneyTransactionView }).data;
}

export async function cancelSendMoneyTransaction(id: string): Promise<void> {
  await apiRequest("POST", `/api/send-money/transactions/${encodeURIComponent(id)}/cancel`, {});
}

/** Dashboard unified-table row shape for send money (display strings, 2dp). */
export interface SendMoneyRow {
  id: string;
  recipient: string;
  service: string;
  date: string;
  amount: string;
  status: string;
}

const SERVICE_LABELS: Record<SendMoneyService, string> = {
  bank_deposit: "Bank Deposit",
  mobile_money: "Mobile Money",
  cash_pickup: "Cash Pickup",
};

export function toSendMoneyRow(view: SendMoneyTransactionView): SendMoneyRow {
  return {
    id: view.reference,
    recipient: view.recipientName,
    service: SERVICE_LABELS[view.service] ?? view.service,
    date: formatShortDate(view.createdAt.slice(0, 10)),
    amount: `${view.sendCurrency} ${view.sendAmount}`,
    status: view.status,
  };
}
