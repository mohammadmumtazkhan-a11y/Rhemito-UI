/**
 * Rhemito supported currencies — the single list every flow uses for both
 * "sender pays in" and payout account currencies, so any registered user in
 * any of these corridors can request money from anyone.
 */

export const SUPPORTED_CURRENCIES = [
  "GBP", "USD", "EUR", "NGN", "GHS", "KES", "ZAR", "INR", "AED", "CAD", "AUD", "JPY", "CNY",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
  GHS: "₵",
  KES: "KSh",
  ZAR: "R",
  INR: "₹",
  AED: "د.إ",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CNY: "¥",
};

/**
 * Routing-field convention per payout currency — local banking standards
 * (sort code, ABA, IBAN/BIC) where they exist; a generic optional bank/SWIFT
 * code elsewhere so local-currency accounts worldwide can be added.
 */
export function routingFieldFor(currency: string): {
  label: string;
  placeholder: string;
  required: boolean;
} {
  switch (currency) {
    case "GBP":
      return { label: "Sort Code", placeholder: "20-45-67", required: true };
    case "USD":
      return { label: "Routing Number (ABA)", placeholder: "021000021", required: true };
    case "EUR":
      return { label: "BIC / SWIFT", placeholder: "DEUTDEFF", required: false };
    case "NGN":
      return { label: "Bank Name Verification", placeholder: "N/A", required: false };
    default:
      return { label: "Bank / SWIFT Code (Optional)", placeholder: "e.g. BARCGB22", required: false };
  }
}

/** Account-number field label per currency. */
export function accountNumberLabelFor(currency: string): string {
  return currency === "EUR" ? "IBAN *" : "Account Number *";
}
