/**
 * Mito Money promo service client (PROMO-RHEMITO §3, P-1 – P-3).
 * Own config read — no import from rewards/referral code.
 */

export const MITO_API_URL = (process.env.MITO_API_URL ?? "http://localhost:5050").replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.MITO_API_TIMEOUT_MS ?? 4000);

export const PROMO_UNAVAILABLE = "Promo codes are unavailable right now. Please try again shortly.";

export interface MitoResult {
  ok: boolean;
  status: number;
  body: Record<string, any>;
  /** Customer-safe message when `ok` is false. */
  error?: string;
  /** Machine code when Mito sent one. */
  code?: string;
}

export function promoEnabled(): boolean {
  return String(process.env.PROMO_ENABLED ?? "true").toLowerCase() !== "false";
}

export async function callMito(path: string, init: { method?: string; body?: unknown } = {}): Promise<MitoResult> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (process.env.PROMO_SERVICE_KEY) headers["X-Promo-Service-Key"] = process.env.PROMO_SERVICE_KEY;
  let res: globalThis.Response;
  try {
    res = await fetch(`${MITO_API_URL}${path}`, {
      method: init.method ?? "POST",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Fails closed: no code is accepted when Mito cannot be reached (P-2)
    return { ok: false, status: 503, body: {}, error: PROMO_UNAVAILABLE, code: "PROMO_UNAVAILABLE" };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    // P-3: read message ?? error as the customer text, code when present
    return { ok: false, status: res.status, body, error: String(body.message ?? body.error ?? "This promo code can't be used."), code: body.code ? String(body.code) : undefined };
  }
  return { ok: true, status: res.status, body };
}

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

/** Check a code for a transfer being built; nothing is recorded. */
export const validatePromo = (input: PromoRequest) => callMito("/api/promocodes/validate", { body: input });
/** Record the use when the transfer is paid. Safe to repeat for the same transactionId. */
export const redeemPromo = (input: PromoRequest) => callMito("/api/promocodes/redeem", { body: input });
/** Give a use back (payment failed after redeem). */
export const releasePromo = (transactionId: string, reason: string) => callMito("/api/promocodes/release", { body: { transaction_id: transactionId, reason } });
