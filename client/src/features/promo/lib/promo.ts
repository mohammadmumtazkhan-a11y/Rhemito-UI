/**
 * Pure promo helpers (PROMO-RHEMITO §7). Unit tested in promo.test.ts.
 */

const SYMBOLS: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", NGN: "₦", INR: "₹", JPY: "¥", CNY: "¥", AUD: "A$", CAD: "C$", ZAR: "R", KES: "KSh ", GHS: "GH₵", AED: "AED ",
};

export const decimalsFor = (currency: string) => (String(currency).toUpperCase() === "JPY" ? 0 : 2);

export function roundFor(amount: number, currency: string): number {
  const f = 10 ** decimalsFor(currency);
  return Math.round((Number(amount) + Number.EPSILON) * f) / f;
}

export function formatMoney(amount: number, currency: string): string {
  const cur = String(currency || "").toUpperCase();
  const dp = decimalsFor(cur);
  const n = Number(amount || 0);
  const sign = n < 0 ? "−" : "";
  return `${sign}${SYMBOLS[cur] ?? `${cur} `}${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

export const normaliseCode = (s: string | null | undefined) => String(s ?? "").trim().toUpperCase();
export const isCodeFormatOk = (s: string) => /^[A-Z0-9-]{1,20}$/.test(normaliseCode(s));

/** Fee after the promo discount, never below 0. */
export function effectiveFee(fee: number, discount: number, currency = "GBP"): number {
  return Math.max(0, roundFor(Number(fee || 0) - Number(discount || 0), currency));
}

/** Total to pay: send amount + fee after promo − other credit (pay less). Never below 0. */
export function totalToPay(send: number, fee: number, discount: number, otherCredit = 0, currency = "GBP"): number {
  return Math.max(0, roundFor(Number(send || 0) + effectiveFee(fee, discount, currency) - Number(otherCredit || 0), currency));
}

export interface PromoInputs {
  amount: number;
  fee: number;
  sendCurrency: string;
  receiveCurrency: string;
  paymentMethod?: string | null;
}

/** True when anything that affects the discount changed (P-41). */
export function shouldRevalidate(prev: PromoInputs | null, next: PromoInputs): boolean {
  if (!prev) return false;
  return prev.amount !== next.amount || prev.fee !== next.fee || prev.sendCurrency !== next.sendCurrency
    || prev.receiveCurrency !== next.receiveCurrency || (prev.paymentMethod ?? "") !== (next.paymentMethod ?? "");
}
