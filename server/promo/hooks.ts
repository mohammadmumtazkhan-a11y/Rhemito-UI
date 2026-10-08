/**
 * Promo hooks called by the host app (PROMO-RHEMITO §5):
 *   - applyForPayment / releaseForPayment — Send Money pay (P-20 – P-25)
 *   - onTransferStatus — report status changes to Mito through the outbox (P-30 – P-33)
 *   - syncCustomer — keep Mito's audience facts current (P-35)
 */

import { storage } from "../storage";
import { toMinorUnits, fromMinorUnits } from "@shared/money";
import type { SendMoneyTransaction } from "@shared/sendMoney";
import { callMito, promoEnabled, redeemPromo, releasePromo, validatePromo } from "./client";
import { createOutbox } from "./outbox";

export class PromoPaymentError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Country (ISO alpha-2) → default send currency. */
const COUNTRY_CURRENCY: Record<string, string> = {
  GB: "GBP", UK: "GBP", US: "USD", NG: "NGN", CA: "CAD", GH: "GHS", KE: "KES", ZA: "ZAR",
  DE: "EUR", FR: "EUR", IN: "INR", CN: "CNY", AE: "AED", AU: "AUD", JP: "JPY",
};
export const currencyForCountry = (country: string | null | undefined) => COUNTRY_CURRENCY[String(country ?? "").toUpperCase()] ?? "GBP";

export const promoOutbox = createOutbox("promo", async (item) => {
  const path = item.kind === "customer" ? "/api/promocodes/customers" : "/api/promocodes/transfer-events";
  const r = await callMito(path, { body: item.payload });
  return { ok: r.ok, status: r.status, error: r.error };
});

// ─── Customer sync (P-35) ────────────────────────────────────────────────────

const lastSync = new Map<string, { payload: string; at: number }>();

export async function syncCustomer(userId: string, opts: { force?: boolean } = {}): Promise<void> {
  if (!promoEnabled()) return;
  const user = await storage.getAuthUserById(userId);
  if (!user) return;
  const status = (user as any).status === "blocked" ? "SUSPENDED" : (user as any).status === "closed" ? "CLOSED" : "ACTIVE";
  const payload = {
    id: user.id,
    created_at: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
    country: user.country ?? null,
    send_currency: currencyForCountry(user.country),
    account_status: status,
    first_name: (user as any).firstName ?? (user as any).businessName ?? null,
    last_name: (user as any).lastName ?? null,
    email: user.email ?? null,
  };
  const json = JSON.stringify(payload);
  const prev = lastSync.get(userId);
  if (!opts.force && prev && prev.payload === json && Date.now() - prev.at < 60_000) return; // debounced
  lastSync.set(userId, { payload: json, at: Date.now() });
  promoOutbox.enqueue("customer", `customer:${userId}`, payload);
}

// ─── Transfer status (P-30 – P-33) ───────────────────────────────────────────

export type PromoTransferStatus = "PAID" | "COMPLETED" | "CANCELLED" | "FAILED" | "REFUNDED" | "RECALLED" | "CHARGEBACK";

export function onTransferStatus(userId: string, tx: SendMoneyTransaction, status: PromoTransferStatus): void {
  if (!promoEnabled()) return;
  promoOutbox.enqueue("transfer", `transfer:${tx.reference}`, {
    transfer_id: tx.reference,
    customer_id: userId,
    amount: Number(fromMinorUnits(tx.sendAmountMinor, tx.sendCurrency)),
    currency: tx.sendCurrency,
    receive_currency: tx.receiveCurrency,
    status,
    created_at: new Date(tx.createdAt).toISOString(),
  });
}

// ─── Payment (P-20 – P-25) ───────────────────────────────────────────────────

export interface PromoAtPayment {
  promoCode: string;
  feeBeforePromoMinor: number;
  feeMinor: number;
  promoDiscountMinor: number;
}

/**
 * Re-check and record the promo code before any money moves. The code is either the one saved when the
 * transaction was created, or one the customer applied on the payment step (sent with the pay request,
 * with the discount they were shown). Returns null when there is no code. Throws PromoPaymentError.
 */
export async function applyForPayment(
  tx: SendMoneyTransaction,
  userId: string,
  paymentMethod: string,
  requested?: { code?: string | null; shownDiscount?: string | number | null },
): Promise<PromoAtPayment | null> {
  if (!promoEnabled()) return null;
  const fromPayStep = !tx.promoCode && requested?.code ? String(requested.code).trim().toUpperCase() : null;
  const code = tx.promoCode ?? fromPayStep;
  if (!code) return null;

  // P-20: everything comes from the stored transaction, never from the browser
  const feeBeforeMinor = tx.promoCode ? tx.feeBeforePromoMinor ?? tx.feeMinor : tx.feeMinor;
  const shownMinor = tx.promoCode
    ? feeBeforeMinor - tx.feeMinor
    : Math.max(0, toMinorUnits(String(requested?.shownDiscount ?? "0"), tx.sendCurrency));
  const request = {
    code,
    userId,
    amount: Number(fromMinorUnits(tx.sendAmountMinor, tx.sendCurrency)),
    fee: Number(fromMinorUnits(feeBeforeMinor, tx.sendCurrency)),
    currency: tx.sendCurrency,
    sourceCurrency: tx.sendCurrency,
    destCurrency: tx.receiveCurrency,
    paymentMethod,
  };
  const reject = (status: number, message: string) =>
    new PromoPaymentError(status === 503 ? 503 : 409, "PROMO_REJECTED", `${message.replace(/\.?$/, ".")} Go back and remove the promo code to continue.`);

  await syncCustomer(userId);
  const check = await validatePromo(request);
  if (!check.ok) throw reject(check.status, check.error ?? "This promo code can no longer be used.");
  const approvedMinor = toMinorUnits(String(check.body.appliedDiscount ?? 0), tx.sendCurrency);
  if (shownMinor > approvedMinor) {
    throw new PromoPaymentError(409, "PROMO_CHANGED", "The promo discount has changed. Go back and review your transfer.");
  }
  const redeemed = await redeemPromo({ ...request, transactionId: tx.reference });
  if (!redeemed.ok) throw reject(redeemed.status, redeemed.error ?? "This promo code can no longer be used.");
  const discountMinor = Math.min(shownMinor, feeBeforeMinor);
  return { promoCode: code, feeBeforePromoMinor: feeBeforeMinor, feeMinor: feeBeforeMinor - discountMinor, promoDiscountMinor: discountMinor };
}

/** P-24: the payment step failed after the code was recorded — give the use back. Never throws. */
export async function releaseForPayment(reference: string): Promise<void> {
  try {
    const r = await releasePromo(reference, "PAYMENT_FAILED");
    if (!r.ok) console.error("[promo] release after failed payment not recorded:", r.error);
  } catch (err) {
    console.error("[promo] release after failed payment not recorded:", err);
  }
}
