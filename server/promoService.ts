/**
 * Promo codes — Rhemito side.
 *
 * Promo codes are created, validated and counted by Mito Admin (PromoCode repo: server/promoEngine.js).
 * Rhemito keeps no promo codes of its own: this module only forwards a customer's code to Mito Admin and
 * hands back its answer. If Mito Admin cannot be reached, a code cannot be used (it fails closed).
 */

import { MITO_API_URL } from "./rewardsService";

const TIMEOUT_MS = Number(process.env.MITO_API_TIMEOUT_MS ?? 4000);

export interface PromoRequest {
  code: string;
  amount?: number;
  fee?: number;
  currency?: string;
  userId?: string;
  sourceCurrency?: string;
  destCurrency?: string;
  paymentMethod?: string;
  transactionId?: string;
}

export interface MitoPromoResult {
  ok: boolean;
  status: number;
  body: Record<string, any>;
  /** Message that is safe to show the customer when `ok` is false. */
  error?: string;
}

async function callMito(path: string, input: PromoRequest): Promise<MitoPromoResult> {
  let res: globalThis.Response;
  try {
    res = await fetch(`${MITO_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 503, body: {}, error: "Promo codes are unavailable right now. Please try again shortly." };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    return { ok: false, status: res.status, body, error: String(body.message ?? body.error ?? "This promo code can't be used.") };
  }
  return { ok: true, status: res.status, body };
}

/** Check a code for a transfer being built; nothing is recorded. */
export const validatePromo = (input: PromoRequest): Promise<MitoPromoResult> => callMito("/api/promocodes/validate", input);

/** Record the use of a code when the transfer is paid. Safe to repeat for the same transactionId. */
export const redeemPromo = (input: PromoRequest): Promise<MitoPromoResult> => callMito("/api/promocodes/redeem", input);
