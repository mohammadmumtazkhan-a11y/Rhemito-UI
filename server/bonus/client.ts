/**
 * Mito Money bonus service client (BONUS-RHEMITO §3).
 * Own config read — imports nothing from referral, promo or rewards code.
 */

export const MITO_API_URL = (process.env.MITO_API_URL ?? "http://localhost:5050").replace(/\/+$/, "");
const TIMEOUT_MS = () => Number(process.env.MITO_API_TIMEOUT_MS ?? 4000);

export const BONUS_UNAVAILABLE = "Bonus credit is unavailable right now. Please try again shortly.";

export interface MitoResult {
  ok: boolean;
  status: number;
  body: Record<string, any>;
  /** Customer-safe message when `ok` is false. */
  error?: string;
  /** Machine code when Mito sent one (e.g. BALANCE_CHANGED). */
  code?: string;
}

export function bonusEnabled(): boolean {
  return String(process.env.BONUS_ENABLED ?? "true").toLowerCase() !== "false";
}

export async function callMito(path: string, init: { method?: string; body?: unknown } = {}): Promise<MitoResult> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (process.env.BONUS_SERVICE_KEY) headers["X-Bonus-Service-Key"] = process.env.BONUS_SERVICE_KEY;
  let res: globalThis.Response;
  try {
    res = await fetch(`${MITO_API_URL}${path}`, {
      method: init.method ?? "POST",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS()),
    });
  } catch {
    return { ok: false, status: 503, body: {}, error: BONUS_UNAVAILABLE, code: "BONUS_UNAVAILABLE" };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    // Mito sends either { error: "text" } or { error: CODE, message }
    const looksLikeCode = typeof body.error === "string" && /^[A-Z_]{4,}$/.test(body.error);
    return {
      ok: false,
      status: res.status,
      body,
      error: String(body.message ?? (looksLikeCode ? "" : body.error) ?? "") || "Your bonus credit can't be used right now.",
      code: looksLikeCode ? String(body.error) : body.code ? String(body.code) : undefined,
    };
  }
  return { ok: true, status: res.status, body };
}

const enc = encodeURIComponent;

export const getWallet = (customerId: string, currency?: string, source?: string) => {
  const q = new URLSearchParams();
  if (currency) q.set("currency", currency);
  if (source) q.set("credit_source", source);
  const qs = q.toString();
  return callMito(`/api/wallet/${enc(customerId)}${qs ? `?${qs}` : ""}`, { method: "GET" });
};
export const getOffers = (currency: string) => callMito(`/api/bonus/offers?currency=${enc(currency)}`, { method: "GET" });
export const applyCredit = (customerId: string, input: { amount: number; currency: string; transferId: string; sendAmount: number }) =>
  callMito(`/api/wallet/${enc(customerId)}/apply`, { body: { amount: input.amount, currency: input.currency, transfer_id: input.transferId, send_amount: input.sendAmount } });
export const releaseCredit = (customerId: string, transferId: string) =>
  callMito(`/api/wallet/${enc(customerId)}/release`, { body: { transfer_id: transferId } });
export const getFeed = (sinceId: number, limit = 100) => callMito(`/api/bonus/feed?since_id=${sinceId}&limit=${limit}`, { method: "GET" });
