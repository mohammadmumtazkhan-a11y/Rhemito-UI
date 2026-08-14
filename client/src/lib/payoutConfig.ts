export interface SupportedCountry {
  code: string;
  name: string;
  currency: string;
  currencyName: string;
  requiresBankAccountType: boolean;
  bankAccountTypeOptions?: { label: string; value: string }[];
}

export const SUPPORTED_COUNTRIES: Record<string, SupportedCountry> = {
  GB: {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    currencyName: "British Pound (GBP)",
    requiresBankAccountType: false,
    bankAccountTypeOptions: [
      { label: "Current", value: "current" },
      { label: "Savings", value: "savings" },
    ],
  },
  NG: {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    currencyName: "Nigerian Naira (NGN)",
    requiresBankAccountType: false,
    bankAccountTypeOptions: [
      { label: "Savings", value: "savings" },
      { label: "Current", value: "current" },
    ],
  },
  US: {
    code: "US",
    name: "United States",
    currency: "USD",
    currencyName: "US Dollar (USD)",
    requiresBankAccountType: true,
    bankAccountTypeOptions: [
      { label: "Checking", value: "checking" },
      { label: "Savings", value: "savings" },
    ],
  },
  CA: {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    currencyName: "Canadian Dollar (CAD)",
    requiresBankAccountType: false,
    bankAccountTypeOptions: [
      { label: "Chequing", value: "chequing" },
      { label: "Savings", value: "savings" },
    ],
  },
};

export const COUNTRY_OPTIONS = [
  { code: "GB", name: "United Kingdom" },
  { code: "NG", name: "Nigeria" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
];

/**
 * Formats a 6-digit sort code with hyphens (e.g. 12-34-56).
 */
export function formatSortCode(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

/**
 * Validates a UK sort code (exactly 6 digits when stripped of hyphens/spaces).
 */
export function isValidSortCode(sortCode: string): boolean {
  const digits = sortCode.replace(/\D/g, "");
  return digits.length === 6 && /^\d{6}$/.test(digits);
}

/**
 * Validates a 9-digit US ABA routing number with standard checksum.
 * Algorithm: (3*(d0 + d3 + d6) + 7*(d1 + d4 + d7) + 1*(d2 + d5 + d8)) % 10 === 0
 */
export function isValidAbaRoutingNumber(routing: string): boolean {
  const digits = routing.replace(/\D/g, "");
  if (digits.length !== 9) return false;
  const d = digits.split("").map(Number);
  const checksum =
    3 * (d[0] + d[3] + d[6]) +
    7 * (d[1] + d[4] + d[7]) +
    1 * (d[2] + d[5] + d[8]);
  return checksum % 10 === 0;
}

/**
 * Masks an account number, showing only the last 4 digits (e.g. "•••• 0011").
 */
export function maskAccountNumber(acc: string): string {
  if (!acc) return "••••";
  // Remove any "-Default a/c" or trailing text
  const clean = acc.split("-")[0].replace(/\D/g, "");
  if (clean.length <= 4) return `•••• ${clean}`;
  return `•••• ${clean.slice(-4)}`;
}

/**
 * Cleans bank details column display for the table based on country/fields
 */
export function formatBankDetailsDisplay(account: {
  country?: string;
  currency?: string;
  routingNumber?: string;
  sortCode?: string;
  institutionNumber?: string;
  transitNumber?: string;
}): string {
  if (account.sortCode) return account.sortCode;
  if (account.institutionNumber && account.transitNumber) {
    return `Inst: ${account.institutionNumber} / Transit: ${account.transitNumber}`;
  }
  if (account.routingNumber && account.routingNumber !== "N/A") {
    return account.routingNumber;
  }
  if (account.currency === "NGN" || account.country === "NG" || account.country === "Nigeria") {
    return "N/A";
  }
  return account.routingNumber || "N/A";
}
