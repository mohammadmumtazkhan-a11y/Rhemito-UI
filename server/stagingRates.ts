/**
 * Mito/FURP affiliate rates client.
 *
 * Reads the rates our affiliate account is configured with from the FURP
 * staging API (GET /Exchange/affiliateRates), authenticating with the affiliate
 * login (POST /Auth/login + ApiKey header → bearer token).
 *
 * Disabled unless FURP_BASE_URL and the credentials are configured, so local
 * runs, unit tests and CI keep using the public-provider/static fallback in
 * fxService. Credentials come only from the environment, never from code.
 *
 * Rate direction (as returned by the API):
 *   BUY  → toAmount = fromAmount × rate
 *   SELL → toAmount = fromAmount ÷ rate   (e.g. NGN→GBP 1887 means 1887 NGN per GBP)
 */

export interface AffiliateRate {
  rateId: string;
  fromCurrency: string;
  toCurrency: string;
  fromCountry: string;
  toCountry: string;
  rateMoneyTransfer: number;
  partnerRateMoneyTransfer: number;
  rateExpiry: string | null;
  rateDirection: "BUY" | "SELL" | string;
}

interface StagingConfig {
  baseUrl: string;
  apiKey: string;
  username: string;
  password: string;
  serviceNo: string;
  affiliateId: string;
}

const RATES_TTL_MS = 2 * 60 * 1000;
const TOKEN_SKEW_MS = 60 * 1000;
const TIMEOUT_MS = () => Number(process.env.FURP_TIMEOUT_MS ?? 5000);

let token: { value: string; expiresAt: number } | null = null;
let ratesCache: { rates: AffiliateRate[]; fetchedAt: number } | null = null;

export function stagingConfig(): StagingConfig | null {
  const baseUrl = (process.env.FURP_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = process.env.FURP_API_KEY ?? "";
  const username = process.env.FURP_USERNAME ?? "";
  const password = process.env.FURP_PASSWORD ?? "";
  const serviceNo = process.env.FURP_SERVICE_NO ?? "";
  const affiliateId = process.env.FURP_AFFILIATE_ID ?? "";
  if (!baseUrl || !apiKey || !username || !password || !serviceNo || !affiliateId) return null;
  return { baseUrl, apiKey, username, password, serviceNo, affiliateId };
}

export function stagingRatesEnabled(): boolean {
  return stagingConfig() !== null;
}

/** Test helper: forget the cached token and rates. */
export function _resetStagingRates(keepToken = false): void {
  if (!keepToken) token = null;
  ratesCache = null;
}

async function login(cfg: StagingConfig): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/Auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ApiKey: cfg.apiKey },
    body: JSON.stringify({
      username: cfg.username,
      password: cfg.password,
      accessServiceNumber: cfg.serviceNo,
      accessAffiliateNumber: cfg.affiliateId,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS()),
  });
  if (!res.ok) throw new Error(`rates login failed (${res.status})`);
  const json = (await res.json()) as { data?: { token?: string; expiresOn?: string } };
  const value = json.data?.token;
  if (!value) throw new Error("rates login returned no token");
  const exp = Date.parse(json.data?.expiresOn ?? "");
  token = { value, expiresAt: Number.isFinite(exp) ? exp - TOKEN_SKEW_MS : Date.now() + 10 * 60 * 1000 };
  return value;
}

async function bearer(cfg: StagingConfig): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  return login(cfg);
}

async function requestRates(cfg: StagingConfig, jwt: string): Promise<Response> {
  return fetch(`${cfg.baseUrl}/Exchange/affiliateRates`, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS()),
  });
}

/** All affiliate rates, cached for two minutes. Throws if the API is unreachable. */
export async function getAffiliateRates(): Promise<AffiliateRate[]> {
  const cfg = stagingConfig();
  if (!cfg) throw new Error("staging rates not configured");
  if (ratesCache && Date.now() - ratesCache.fetchedAt < RATES_TTL_MS) return ratesCache.rates;

  let res = await requestRates(cfg, await bearer(cfg));
  if (res.status === 401) {
    token = null;
    res = await requestRates(cfg, await login(cfg));
  }
  if (!res.ok) throw new Error(`affiliate rates returned ${res.status}`);
  const json = (await res.json()) as { data?: AffiliateRate[] };
  if (!Array.isArray(json.data)) throw new Error("affiliate rates response malformed");
  ratesCache = { rates: json.data, fetchedAt: Date.now() };
  return json.data;
}

function usable(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Units of `to` per 1 unit of `from` from one affiliate rate row. */
function multiplier(row: AffiliateRate, reverse: boolean): number | null {
  const rate = row.rateMoneyTransfer;
  if (!usable(rate)) return null;
  const forward = String(row.rateDirection).toUpperCase() === "SELL" ? 1 / rate : rate;
  return reverse ? 1 / forward : forward;
}

/**
 * Rate for 1 unit of `from` in `to` from the affiliate table, or null when the
 * pair is not configured (callers then use the fallback provider). Prefers a
 * direct row and falls back to the inverse of the opposite row.
 */
export async function getStagingFxRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  const rates = await getAffiliateRates();
  const direct = rates.find((r) => r.fromCurrency === from && r.toCurrency === to);
  if (direct) {
    const m = multiplier(direct, false);
    if (m) return m;
  }
  const opposite = rates.find((r) => r.fromCurrency === to && r.toCurrency === from);
  if (opposite) {
    const m = multiplier(opposite, true);
    if (m) return m;
  }
  return null;
}
