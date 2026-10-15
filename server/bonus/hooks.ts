/**
 * Bonus hooks called by the host app (BONUS-RHEMITO §5):
 *   - applyForPayment / releaseForPayment — Send Money pay (B-20 – B-24)
 *   - onTransferStatus — report status changes to Mito through the outbox (B-10 – B-12)
 *   - syncCustomer — keep Mito's customer facts current (B-30)
 */

import { storage } from "../storage";
import { toMinorUnits, fromMinorUnits } from "@shared/money";
import type { SendMoneyTransaction } from "@shared/sendMoney";
import { applyCredit, bonusEnabled, callMito, getWallet, releaseCredit } from "./client";
import { createOutbox } from "./outbox";

export class BonusPaymentError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Country (ISO alpha-2) → default send currency (B-30). */
const COUNTRY_CURRENCY: Record<string, string> = {
  GB: "GBP", UK: "GBP", US: "USD", NG: "NGN", CA: "CAD", GH: "GHS", KE: "KES", ZA: "ZAR",
  DE: "EUR", FR: "EUR", IN: "INR", CN: "CNY", AE: "AED", AU: "AUD", JP: "JPY",
};
export const currencyForCountry = (country: string | null | undefined) => COUNTRY_CURRENCY[String(country ?? "").toUpperCase()] ?? "GBP";

export const bonusOutbox = createOutbox("bonus", async (item) => {
  const path = item.kind === "customer" ? "/api/bonus/customers" : "/api/bonus/transfer-events";
  const r = await callMito(path, { body: item.payload });
  return { ok: r.ok, status: r.status, error: r.error };
});

// ─── Customer sync (B-30) ────────────────────────────────────────────────────

const lastSync = new Map<string, { payload: string; at: number }>();
export function __resetBonusSync(): void { lastSync.clear(); }

export async function syncCustomer(userId: string, opts: { force?: boolean } = {}): Promise<void> {
  if (!bonusEnabled()) return;
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
  bonusOutbox.enqueue("customer", `customer:${userId}`, payload);
}

// ─── Transfer status (B-10 – B-12) ───────────────────────────────────────────

export type BonusTransferStatus = "PAID" | "COMPLETED" | "CANCELLED" | "FAILED" | "REFUNDED" | "RECALLED" | "CHARGEBACK";

export function onTransferStatus(userId: string, tx: SendMoneyTransaction, status: BonusTransferStatus): void {
  if (!bonusEnabled()) return;
  // Mito needs to know the customer before it can award; the outbox keeps order per key, so send it first
  void syncCustomer(userId).catch(() => {});
  bonusOutbox.enqueue("transfer", `transfer:${tx.reference}`, {
    transfer_id: tx.reference,
    customer_id: userId,
    amount: Number(fromMinorUnits(tx.sendAmountMinor, tx.sendCurrency)),
    currency: tx.sendCurrency,
    receive_currency: tx.receiveCurrency,
    status,
    created_at: new Date(tx.createdAt).toISOString(),
  });
}

// ─── Payment (B-20 – B-24) ───────────────────────────────────────────────────

export interface BonusRequest { mode: "pay_less" | "send_more"; amount: string | number }
export interface BonusAtPayment { mode: "pay_less" | "send_more"; amountMinor: number }

/**
 * Re-check and use the bonus before any money moves. Throws BonusPaymentError (B-23); the transfer
 * is then not paid. Returns null when no bonus was asked for.
 */
export async function applyForPayment(tx: SendMoneyTransaction, userId: string, requested?: BonusRequest | null): Promise<BonusAtPayment | null> {
  if (!requested) return null;
  const currency = tx.sendCurrency;
  const askedMinor = toMinorUnits(String(requested.amount), currency);
  if (!(askedMinor > 0)) return null;
  if (!bonusEnabled()) throw new BonusPaymentError(503, "BONUS_UNAVAILABLE", UNAVAILABLE);

  // B-22: never more than the send amount (the whole balance is checked by Mito)
  if (askedMinor > tx.sendAmountMinor) throw new BonusPaymentError(400, "BONUS_TOO_HIGH", "Bonus cannot be more than the amount you send.");

  await syncCustomer(userId);
  const result = await applyCredit(userId, {
    amount: Number(fromMinorUnits(askedMinor, currency)),
    currency,
    transferId: tx.reference,
    sendAmount: Number(fromMinorUnits(tx.sendAmountMinor, currency)),
  });
  if (!result.ok) {
    if (result.code === "ALREADY_APPLIED") {
      // A retry of the same payment: Mito already holds this bonus for the transfer
      return { mode: requested.mode, amountMinor: askedMinor };
    }
    if (result.code === "BALANCE_CHANGED") throw new BonusPaymentError(409, "BONUS_CHANGED", "Your bonus balance has changed. Please review your transfer.");
    if (result.status === 503 || result.status >= 500) throw new BonusPaymentError(503, "BONUS_UNAVAILABLE", UNAVAILABLE);
    if (/send amount/i.test(result.error ?? "")) throw new BonusPaymentError(400, "BONUS_TOO_HIGH", "Bonus cannot be more than the amount you send.");
    throw new BonusPaymentError(409, "BONUS_CHANGED", result.error || "Your bonus balance has changed. Please review your transfer.");
  }
  return { mode: requested.mode, amountMinor: askedMinor };
}

export const UNAVAILABLE = `Bonus credit can't be used right now. Choose "Don't use bonus" to continue, or try again shortly.`;

/** B-21: payment failed after the bonus was used — give it back. Never throws. */
export async function releaseForPayment(userId: string, reference: string): Promise<void> {
  try {
    const r = await releaseCredit(userId, reference);
    if (!r.ok) console.error("[bonus] release after failed payment not recorded:", r.error);
  } catch (err) {
    console.error("[bonus] release after failed payment not recorded:", err);
  }
}

/** The customer's wallet for a currency (B-51), or null when Mito cannot be reached. */
export async function walletFor(userId: string, currency?: string, source?: string) {
  return getWallet(userId, currency, source);
}
