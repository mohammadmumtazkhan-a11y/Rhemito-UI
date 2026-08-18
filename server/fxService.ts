/**
 * FX Service — Rhemito
 *
 * World-standard rate handling for a prototype: live mid-market rates from a
 * free, key-less provider with a 1-hour in-memory cache, an extended static
 * fallback table for offline/deterministic runs, and a HARD ERROR when a pair
 * cannot be priced — never a silent 1:1 fallback that would misprice money.
 */

const LIVE_RATES_URL = "https://open.er-api.com/v6/latest";
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Indicative static rates (per 1 unit of the base currency). */
export const STATIC_FX_RATES: Record<string, Record<string, number>> = {
  GBP: { GBP: 1, USD: 1.27, EUR: 1.17, NGN: 2000, GHS: 19.5, KES: 164, ZAR: 23.5, INR: 106, AED: 4.66, CAD: 1.71, AUD: 1.92, JPY: 189, CNY: 9.05 },
  USD: { USD: 1, GBP: 0.79, EUR: 0.92, NGN: 1575, GHS: 15.4, KES: 129, ZAR: 18.5, INR: 83.5, AED: 3.67, CAD: 1.35, AUD: 1.51, JPY: 149, CNY: 7.13 },
  EUR: { EUR: 1, GBP: 0.85, USD: 1.09, NGN: 1712, GHS: 16.8, KES: 141, ZAR: 20.2, INR: 90.8, AED: 4.0, CAD: 1.47, AUD: 1.64, JPY: 162, CNY: 7.76 },
  NGN: { NGN: 1, GBP: 0.0005, USD: 0.00063, EUR: 0.00058, GHS: 0.0098, KES: 0.082, ZAR: 0.0118, INR: 0.053, AED: 0.0023, CAD: 0.00086, AUD: 0.00096, JPY: 0.095, CNY: 0.0045 },
  GHS: { GHS: 1, GBP: 0.051, USD: 0.065, EUR: 0.06, NGN: 102, KES: 8.4, ZAR: 1.21, INR: 5.4, AED: 0.24, CAD: 0.088, AUD: 0.098, JPY: 9.7, CNY: 0.46 },
  KES: { KES: 1, GBP: 0.0061, USD: 0.0078, EUR: 0.0071, NGN: 12.2, GHS: 0.12, ZAR: 0.144, INR: 0.65, AED: 0.028, CAD: 0.0105, AUD: 0.0117, JPY: 1.16, CNY: 0.055 },
  ZAR: { ZAR: 1, GBP: 0.043, USD: 0.054, EUR: 0.05, NGN: 85, GHS: 0.83, KES: 6.95, INR: 4.5, AED: 0.2, CAD: 0.073, AUD: 0.082, JPY: 8.05, CNY: 0.385 },
  INR: { INR: 1, GBP: 0.0094, USD: 0.012, EUR: 0.011, NGN: 18.9, GHS: 0.185, KES: 1.54, ZAR: 0.22, AED: 0.044, CAD: 0.016, AUD: 0.018, JPY: 1.78, CNY: 0.085 },
  AED: { AED: 1, GBP: 0.215, USD: 0.272, EUR: 0.25, NGN: 430, GHS: 4.2, KES: 35.2, ZAR: 5.05, INR: 22.75, CAD: 0.368, AUD: 0.412, JPY: 40.6, CNY: 1.94 },
  CAD: { CAD: 1, GBP: 0.585, USD: 0.74, EUR: 0.68, NGN: 1165, GHS: 11.4, KES: 95.5, ZAR: 13.7, INR: 61.6, AED: 2.72, AUD: 1.13, JPY: 110.5, CNY: 5.28 },
  AUD: { AUD: 1, GBP: 0.52, USD: 0.66, EUR: 0.61, NGN: 1040, GHS: 10.2, KES: 85.4, ZAR: 12.25, INR: 55.1, AED: 2.43, CAD: 0.885, JPY: 98.3, CNY: 4.7 },
  JPY: { JPY: 1, GBP: 0.0053, USD: 0.0067, EUR: 0.0062, NGN: 10.55, GHS: 0.103, KES: 0.862, ZAR: 0.124, INR: 0.562, AED: 0.0246, CAD: 0.009, AUD: 0.0102, CNY: 0.048 },
  CNY: { CNY: 1, GBP: 0.11, USD: 0.14, EUR: 0.129, NGN: 221, GHS: 2.16, KES: 18.1, ZAR: 2.6, INR: 11.7, AED: 0.515, CAD: 0.189, AUD: 0.213, JPY: 20.85 },
};

const rateCache = new Map<string, { rates: Record<string, number>; fetchedAt: number }>();

export class FxError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface LiveRatesResponse {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
}

async function fetchLiveRates(base: string): Promise<Record<string, number>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${LIVE_RATES_URL}/${encodeURIComponent(base)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`FX provider returned ${res.status}`);
    const json = (await res.json()) as LiveRatesResponse;
    if (json.result !== "success" || !json.rates) {
      throw new Error("FX provider response malformed");
    }
    return json.rates;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Mid-market rate for 1 unit of `from` in `to`. Live-first with static
 * fallback; throws FxError when the pair genuinely cannot be priced.
 */
export async function getFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const cached = rateCache.get(from);
  let rates: Record<string, number> | undefined;

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    rates = cached.rates;
  } else {
    try {
      const live = await fetchLiveRates(from);
      rateCache.set(from, { rates: live, fetchedAt: Date.now() });
      rates = live;
    } catch (err) {
      console.warn(
        `[fxService] live rates unavailable for ${from}, using static table:`,
        err instanceof Error ? err.message : err,
      );
      rates = STATIC_FX_RATES[from];
    }
  }

  const rate = rates?.[to];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new FxError(
      "FX_UNAVAILABLE",
      `An exchange rate for ${from} to ${to} is currently unavailable. Please try again shortly.`,
    );
  }
  return rate;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
