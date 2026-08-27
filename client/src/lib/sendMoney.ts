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
}

export async function createSendMoneyTransaction(input: CreateSendMoneyInput): Promise<SendMoneyTransactionView> {
  const res = await apiRequest("POST", "/api/send-money/transactions", input);
  return ((await res.json()) as { data: SendMoneyTransactionView }).data;
}

export async function getSendMoneyTransactions(): Promise<SendMoneyTransactionView[]> {
  const res = await apiRequest("GET", "/api/send-money/transactions");
  return ((await res.json()) as { data: SendMoneyTransactionView[] }).data;
}

export async function paySendMoneyTransaction(id: string, paymentMethod: SendMoneyPaymentMethod): Promise<SendMoneyTransactionView> {
  const res = await apiRequest("POST", `/api/send-money/transactions/${encodeURIComponent(id)}/pay`, { paymentMethod });
  return ((await res.json()) as { data: SendMoneyTransactionView }).data;
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
