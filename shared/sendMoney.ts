/**
 * Send Money transaction store — server-owned so the Dashboard unified
 * Transactions table, the cancel flow and notifications survive navigation and
 * live-update via polling like the money-in flows. Follows the same MemStorage
 * pattern as invoices, money requests and GroupPay campaigns.
 */

import { z } from "zod";

export const SEND_MONEY_STATUSES = ["awaiting_payment", "pending", "completed", "failed", "cancelled"] as const;
export type SendMoneyStatus = (typeof SEND_MONEY_STATUSES)[number];

export const SEND_MONEY_SERVICES = ["bank_deposit", "mobile_money", "cash_pickup"] as const;
export type SendMoneyService = (typeof SEND_MONEY_SERVICES)[number];

export const SEND_MONEY_PAYMENT_METHODS = ["instant_bank", "card", "manual_transfer", "wallet"] as const;
export type SendMoneyPaymentMethod = (typeof SEND_MONEY_PAYMENT_METHODS)[number];

/** Instant methods capture immediately (prototype); manual transfer keeps the payment window open. */
export function statusForPaymentMethod(method: SendMoneyPaymentMethod): SendMoneyStatus {
  return method === "manual_transfer" ? "awaiting_payment" : "completed";
}

export interface SendMoneyTransaction {
  id: string;
  ownerId: string;
  /** `TXN-YYYYMM-#####` (seeded demo rows keep their legacy numeric refs). */
  reference: string;
  recipientName: string;
  service: SendMoneyService;
  paymentMethod: SendMoneyPaymentMethod | null;
  sendCurrency: string;
  sendAmountMinor: number;
  receiveCurrency: string;
  receiveAmountMinor: number;
  feeMinor: number;
  /** Snapshot of the rate used, informational. */
  exchangeRate: string;
  promoCode: string | null;
  /** Fee before the promo discount, minor units. Lets the server re-check the discount with Mito Admin when the transfer is paid. */
  feeBeforePromoMinor?: number | null;
  /** Promo discount Mito recorded for this transfer (minor units) and when (PROMO-RHEMITO P-25). */
  promoDiscountMinor?: number | null;
  promoRedeemedAt?: Date | null;
  /** Bonus credit used on this transfer (minor units) and how (BONUS-RHEMITO B-24). */
  bonusCreditMinor?: number | null;
  bonusCreditMode?: "pay_less" | "send_more" | null;
  status: SendMoneyStatus;
  createdAt: Date;
  paidAt: Date | null;
  cancelledAt: Date | null;
}

export const createSendMoneyTransactionSchema = z.object({
  recipientName: z.string().trim().min(1).max(120),
  service: z.enum(SEND_MONEY_SERVICES),
  sendCurrency: z.string().trim().length(3).default("GBP"),
  sendAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid send amount"),
  receiveCurrency: z.string().trim().length(3),
  receiveAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid receive amount"),
  fee: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid fee"),
  exchangeRate: z.string().trim().min(1),
  promoCode: z.string().trim().max(40).optional(),
  feeBeforePromo: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid fee").optional(),
});

export const paySendMoneyTransactionSchema = z.object({
  paymentMethod: z.enum(SEND_MONEY_PAYMENT_METHODS),
  /** A promo code applied on the payment step, with the discount the customer was shown (PROMO-RHEMITO P-20). */
  promoCode: z.string().trim().max(20).optional(),
  promoDiscount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid discount").optional(),
  /** Bonus credit chosen on the payment step (BONUS-RHEMITO B-20). */
  bonusCredit: z
    .object({
      mode: z.enum(["pay_less", "send_more"]),
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid bonus amount"),
    })
    .optional(),
});

/** API shape — money as display strings (2dp) and ISO timestamps. */
export interface SendMoneyTransactionView {
  id: string;
  reference: string;
  recipientName: string;
  service: SendMoneyService;
  paymentMethod: SendMoneyPaymentMethod | null;
  sendCurrency: string;
  sendAmount: string;
  receiveCurrency: string;
  receiveAmount: string;
  fee: string;
  exchangeRate: string;
  promoCode: string | null;
  /** Promo discount recorded at payment, display string (2dp) or null. */
  promoDiscount?: string | null;
  /** Bonus credit used, display string (2dp), and how it was used (BONUS-RHEMITO B-24). */
  bonusCredit?: string | null;
  bonusCreditMode?: "pay_less" | "send_more" | null;
  status: SendMoneyStatus;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
}
