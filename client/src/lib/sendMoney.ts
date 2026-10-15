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
  /** Full record, present once the transfer has been paid; powers the receipt. */
  receipt?: SendMoneyTransactionView;
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
    ...(view.paidAt ? { receipt: view } : {}),
  };
}

export interface ReceiptLine {
  key: "send" | "fee" | "promo" | "bonus_pay_less" | "bonus_send_more" | "total" | "receive";
  label: string;
  /** Signed display amount, e.g. "−GBP 5.00". */
  value: string;
  tone?: "discount" | "total";
}

/**
 * Money lines of a paid transfer (PROMO/BONUS-RHEMITO). The stored fee is the fee after the promo discount,
 * so the fee line shows it before the discount and the promo line takes the discount off. Pay-less bonus
 * reduces the total paid; Send-more bonus adds to the amount converted and leaves the total unchanged.
 */
export function receiptLines(v: SendMoneyTransactionView): ReceiptLine[] {
  const num = (x?: string | null) => (x ? Number(x) : 0);
  const cur = v.sendCurrency;
  const money = (n: number) => `${cur} ${n.toFixed(2)}`;
  const send = num(v.sendAmount);
  const fee = num(v.fee);
  const promo = num(v.promoDiscount);
  const bonus = num(v.bonusCredit);
  const payLess = v.bonusCreditMode === "pay_less" ? bonus : 0;
  const sendMore = v.bonusCreditMode === "send_more" ? bonus : 0;
  const lines: ReceiptLine[] = [
    { key: "send", label: "You send", value: money(send) },
    { key: "fee", label: "Transfer fee", value: money(fee + promo) },
  ];
  if (promo > 0) lines.push({ key: "promo", label: v.promoCode ? `Promo code ${v.promoCode}` : "Promo code", value: `−${money(promo)}`, tone: "discount" });
  if (payLess > 0) lines.push({ key: "bonus_pay_less", label: "Bonus credit used", value: `−${money(payLess)}`, tone: "discount" });
  if (sendMore > 0) lines.push({ key: "bonus_send_more", label: "Bonus added to your transfer", value: `+${money(sendMore)}`, tone: "discount" });
  lines.push({ key: "total", label: "Total paid", value: money(Math.max(0, send + fee - payLess)), tone: "total" });
  lines.push({ key: "receive", label: "Recipient gets", value: `${v.receiveCurrency} ${num(v.receiveAmount).toFixed(2)}` });
  return lines;
}
