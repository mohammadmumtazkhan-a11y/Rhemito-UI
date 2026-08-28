import type { KnownRecipient } from "@/data/recipients";

export type RecipientSortField = "name" | "country" | "serviceType" | "createdAt";
export type SortDirection = "asc" | "desc";

/** Payout currency per supported receiving country (see CLAUDE.md corridors). */
export const COUNTRY_CURRENCY: Record<string, string> = {
  "United Kingdom": "GBP",
  "United States": "USD",
  Nigeria: "NGN",
  Canada: "CAD",
  Ghana: "GHS",
  Kenya: "KES",
  "South Africa": "ZAR",
  Germany: "EUR",
  France: "EUR",
  India: "INR",
  China: "CNY",
  "United Arab Emirates": "AED",
};

export function currencyForCountry(country: string): string {
  return COUNTRY_CURRENCY[country] ?? "USD";
}

export interface BankFieldConfig {
  sortCode: boolean;
  iban: boolean;
  swift: boolean;
}

/** Which country-specific routing fields a recipient's bank details need. */
export function bankFieldsFor(country: string): BankFieldConfig {
  switch (country) {
    case "United Kingdom":
      return { sortCode: true, iban: false, swift: false };
    case "Germany":
    case "France":
      return { sortCode: false, iban: true, swift: false };
    case "United States":
    case "Canada":
    case "China":
    case "United Arab Emirates":
    case "India":
      return { sortCode: false, iban: false, swift: true };
    default:
      return { sortCode: false, iban: false, swift: false };
  }
}

/** Narration/TXN remarks are mandatory for Nigerian beneficiaries. */
export function requiresNarration(country: string): boolean {
  return country === "Nigeria";
}

export function displayName(recipient: KnownRecipient): string {
  if (recipient.recipientType === "business") return recipient.businessName;
  return `${recipient.firstName} ${recipient.lastName}`.trim();
}

export function initials(recipient: KnownRecipient): string {
  if (recipient.recipientType === "business") {
    return recipient.businessName.slice(0, 2).toUpperCase();
  }
  const first = recipient.firstName.charAt(0);
  const last = recipient.lastName.charAt(0);
  return `${first}${last}`.toUpperCase();
}

export const SERVICE_TYPES = ["Bank Deposit", "Mobile Money", "SWIFT"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export interface ServiceTypeStyle {
  pillClass: string;
  dotClass: string;
}

export function serviceTypeStyle(serviceType: string): ServiceTypeStyle {
  switch (serviceType) {
    case "Mobile Money":
      return {
        pillClass: "bg-purple-50 text-purple-700 border-purple-200",
        dotClass: "bg-purple-500",
      };
    case "SWIFT":
      return {
        pillClass: "bg-teal-50 text-teal-700 border-teal-200",
        dotClass: "bg-teal-500",
      };
    default:
      return {
        pillClass: "bg-blue-50 text-blue-700 border-blue-200",
        dotClass: "bg-blue-500",
      };
  }
}

/** Case-insensitive filter over display name and country. */
export function searchRecipients(
  recipients: KnownRecipient[],
  query: string
): KnownRecipient[] {
  const searchLower = query.trim().toLowerCase();
  if (!searchLower) return recipients;
  return recipients.filter(
    (recipient) =>
      displayName(recipient).toLowerCase().includes(searchLower) ||
      recipient.country.toLowerCase().includes(searchLower)
  );
}

export function sortRecipients(
  recipients: KnownRecipient[],
  field: RecipientSortField,
  direction: SortDirection
): KnownRecipient[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...recipients].sort((a, b) => {
    let result: number;
    switch (field) {
      case "country":
        result = a.country.localeCompare(b.country);
        break;
      case "serviceType":
        result = a.serviceType.localeCompare(b.serviceType);
        break;
      case "createdAt":
        result = a.createdAt.localeCompare(b.createdAt);
        break;
      case "name":
      default:
        result = displayName(a).localeCompare(displayName(b));
        break;
    }
    return result * factor;
  });
}

export interface PaginatedRecipients {
  rows: KnownRecipient[];
  totalPages: number;
  safePage: number;
  /** 1-based index of the first row shown (0 when the list is empty). */
  start: number;
  /** 1-based index of the last row shown (0 when the list is empty). */
  end: number;
  total: number;
}

export function paginateRecipients(
  recipients: KnownRecipient[],
  page: number,
  pageSize: number
): PaginatedRecipients {
  const total = recipients.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rows = recipients.slice((safePage - 1) * pageSize, safePage * pageSize);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = total === 0 ? 0 : (safePage - 1) * pageSize + rows.length;
  return { rows, totalPages, safePage, start, end, total };
}

/** 6-digit payout identifier, guaranteed unique against existing codes. */
export function generateUniqueCode(
  existingCodes: string[],
  rng: () => number = Math.random
): string {
  const taken = new Set(existingCodes);
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = String(Math.floor(rng() * 1_000_000)).padStart(6, "0");
    if (!taken.has(code)) return code;
  }
  // Deterministic fallback if the generator keeps colliding.
  let counter = 1;
  while (taken.has(String(counter).padStart(6, "0"))) counter++;
  return String(counter).padStart(6, "0");
}
