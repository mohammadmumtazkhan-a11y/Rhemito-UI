/**
 * Money helpers — Request Money.
 *
 * All internal amounts are integer minor units (pence, kobo, cents…).
 * Zero-decimal currencies (JPY, NGN pre-2007 etc.) use a factor of 1.
 * No floating-point arithmetic on financial amounts.
 */

export function minorUnitFactor(currency: string): number {
  return currency === "JPY" ? 1 : 100;
}

/** "123.45" + "GBP" → 12345. Throws on anything that is not exact money. */
export function toMinorUnits(amount: string, currency: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const factor = minorUnitFactor(currency);
  if (factor === 1) {
    return Math.round(parseFloat(amount));
  }
  const [whole, frac = ""] = amount.split(".");
  const paddedFrac = (frac + "00").slice(0, 2);
  return Number(whole) * factor + Number(paddedFrac);
}

/** 12345 + "GBP" → "123.45" (or "12345" for zero-decimal currencies). */
export function fromMinorUnits(minor: number, currency: string): string {
  const factor = minorUnitFactor(currency);
  if (factor === 1) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / factor)}.${String(abs % factor).padStart(2, "0")}`;
}

/**
 * Rhemito fee — always 3% of the requested (base) amount in both modes:
 * absorbed by the requester (sender pays exactly the requested amount) or
 * added to the sender's payment (requester receives the full requested amount).
 */
export function feeMinorOf(grossMinor: number, feeRate: number): number {
  return Math.round(grossMinor * feeRate);
}

/** Amount the sender is charged: the requested amount, plus the fee when the requester does not absorb it. */
export function senderPaysMinorOf(requestedMinor: number, feeMinor: number, absorbFee: boolean): number {
  return absorbFee ? requestedMinor : requestedMinor + feeMinor;
}

/** Requester proceeds: requested amount minus the fee when absorbed, otherwise the full requested amount. */
export function netMinorOf(requestedMinor: number, feeMinor: number, absorbFee: boolean): number {
  return absorbFee ? requestedMinor - feeMinor : requestedMinor;
}

/**
 * Convert minor units between currencies with a mid-market rate, applying the
 * disclosed FX markup by reducing the rate offered to the customer.
 */
export function applyFxMarkup(midRate: number, markup: number): number {
  return midRate * (1 - markup);
}

export function convertMinor(amountMinor: number, rate: number): number {
  return Math.round(amountMinor * rate);
}

/** Mask an account number for display/API responses: "****0011". */
export function maskAccountNumber(accountNumber: string): string {
  const tail = accountNumber.slice(-4);
  return `****${tail}`;
}
