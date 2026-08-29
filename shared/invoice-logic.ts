/**
 * Send Invoice MVP1 — pure domain logic shared by the server, the client and
 * the unit tests. No side effects, no storage, no clock access: every function
 * takes "now" (or a timezone) explicitly so behaviour is deterministic.
 */

import type {
  InvoiceExpiry,
  InvoiceStatus,
} from "./schema";

/**
 * Rhemito has no account/affiliate timezone hierarchy today, so invoice expiry
 * uses a single product-wide timezone (UK-based product, GBP default). Stored
 * per invoice so a future hierarchy can backfill real per-sender values.
 */
export const EXPIRY_TIMEZONE = "Europe/London";
export const EXPIRY_TIMEZONE_LABEL = "UK time";

export const FEE_RATE = 0.03;

// ─── Timezone helpers (Intl-based, no external dependencies) ──────────────────

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant of `hour:minute:second` local time on a YYYY-MM-DD date. */
export function zonedTimeOnDateUTC(
  dateStr: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, hour, minute, second);
  let ts = naive;
  // Two passes converge even across DST boundaries.
  for (let i = 0; i < 2; i++) {
    ts = naive - tzOffsetMs(new Date(ts), timeZone);
  }
  return new Date(ts);
}

/** The invoice stays payable until 11:59:59 p.m. on the expiry date, local time. */
export function zonedEndOfDayUTC(dateStr: string, timeZone: string): Date {
  return zonedTimeOnDateUTC(dateStr, 23, 59, 59, timeZone);
}

/** Local calendar date (YYYY-MM-DD) of an instant, in the given timezone. */
export function dateInTz(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(date); // en-CA yields YYYY-MM-DD
}

/** Calendar-day arithmetic on YYYY-MM-DD strings (DST-safe, UTC math). */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

// ─── Expiry calculation ───────────────────────────────────────────────────────

export interface ExpiryComputation {
  expiryDate: string; // YYYY-MM-DD shown to users
  baseDate: string; // date the preset period was calculated from
  expiresAt: Date; // exact UTC instant
}

/**
 * Preset periods are calculated from the Due Date when one is provided,
 * otherwise from the date the invoice is sent (i.e. "today" at confirmation).
 */
export function computeExpiry(
  dueDate: string | null | undefined,
  expiry: InvoiceExpiry,
  now: Date,
  timeZone: string = EXPIRY_TIMEZONE,
): ExpiryComputation {
  const today = dateInTz(now, timeZone);
  const baseDate = dueDate ?? today;
  const expiryDate =
    expiry.type === "preset" ? addDays(baseDate, expiry.days) : expiry.date;
  return {
    expiryDate,
    baseDate,
    expiresAt: zonedEndOfDayUTC(expiryDate, timeZone),
  };
}

export const DATE_VALIDATION_MESSAGES = {
  dueDatePast: "The Due Date cannot be in the past.",
  expiryNotFuture: "Select a future Payment Link Expiry Date.",
  expiryBeforeDue: "The Payment Link Expiry Date cannot be earlier than the Due Date.",
  alreadySent: "This invoice has already been sent and cannot be edited.",
} as const;

/**
 * Authoritative date validation, re-run at final confirmation.
 * Returns every violation — callers surface the first.
 */
export function validateInvoiceDates(
  dueDate: string | null | undefined,
  expiry: InvoiceExpiry,
  now: Date,
  timeZone: string = EXPIRY_TIMEZONE,
): { computation: ExpiryComputation; errors: string[] } {
  const errors: string[] = [];
  const today = dateInTz(now, timeZone);

  if (dueDate) {
    if (!isValidIsoDate(dueDate) || dueDate < today) {
      errors.push(DATE_VALIDATION_MESSAGES.dueDatePast);
    }
  }

  const computation = computeExpiry(dueDate, expiry, now, timeZone);

  if (computation.expiryDate <= today) {
    errors.push(DATE_VALIDATION_MESSAGES.expiryNotFuture);
  }
  if (dueDate && isValidIsoDate(dueDate) && dueDate >= today && computation.expiryDate < dueDate) {
    errors.push(DATE_VALIDATION_MESSAGES.expiryBeforeDue);
  }

  return { computation, errors };
}

/** Default preset: 7 days after Due Date, or 30 days after the sent date. */
export function defaultExpiryPresetDays(dueDate: string | null | undefined): 7 | 30 {
  return dueDate ? 7 : 30;
}

// ─── Status derivation ────────────────────────────────────────────────────────

export interface InvoiceStatusInput {
  // string (not the narrowed union) because the Drizzle-inferred Invoice type
  // types text columns as string; the service only ever writes valid values.
  status: string;
  dueDate: string | null;
  expiresAt: Date;
  expiryTimezone: string;
}

/**
 * Display status with precedence:
 * Paid > Payment Processing > Cancelled > Expired > Overdue > Sent.
 * "Expired" is derived in real time from expiresAt — never applied to
 * Paid / Processing / Cancelled invoices.
 */
export function deriveInvoiceStatus(inv: InvoiceStatusInput, now: Date): InvoiceStatus {
  if (inv.status === "paid") return "paid";
  if (inv.status === "payment_processing") return "payment_processing";
  if (inv.status === "cancelled") return "cancelled";
  if (inv.status === "expired") return "expired";
  if (now.getTime() >= inv.expiresAt.getTime()) return "expired";
  if (inv.dueDate && now.getTime() > zonedEndOfDayUTC(inv.dueDate, inv.expiryTimezone).getTime()) {
    return "overdue";
  }
  return "sent";
}

/** True once the due date's day has fully passed in the invoice timezone. */
export function isOverdue(
  dueDate: string | null,
  expiryTimezone: string,
  now: Date,
): boolean {
  if (!dueDate) return false;
  return now.getTime() > zonedEndOfDayUTC(dueDate, expiryTimezone).getTime();
}

// ─── Fees ─────────────────────────────────────────────────────────────────────

export interface InvoiceFeeBreakdown {
  invoiceAmount: number;
  fee: number;
  clientPays: number;
  senderReceives: number;
}

export function computeInvoiceFees(
  amount: string | number,
  absorbFee: boolean,
): InvoiceFeeBreakdown {
  const invoiceAmount = typeof amount === "number" ? amount : parseFloat(amount) || 0;
  const fee = round2(invoiceAmount * FEE_RATE);
  return {
    invoiceAmount: round2(invoiceAmount),
    fee,
    clientPays: round2(absorbFee ? invoiceAmount : invoiceAmount + fee),
    senderReceives: round2(absorbFee ? invoiceAmount - fee : invoiceAmount),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Generated invoice totals ("generate on the go") ──────────────────────────

export interface InvoiceTotalsInput {
  items: ReadonlyArray<{ quantity: number | string; unitAmount: number | string }> | null;
  taxRate?: string | number | null;
  discountType?: string | null; // "percent" | "fixed" | null
  discountValue?: string | number | null;
}

export interface InvoiceTotals {
  subtotal: number; // Σ round2(quantity × unitAmount)
  discountAmount: number; // fixed capped at subtotal; percent of subtotal
  taxAmount: number; // taxRate % of (subtotal − discountAmount)
  total: number; // authoritative invoice amount
}

function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Totals for a generated invoice. Accepts both the API payload shape (numbers)
 * and the stored invoice shape (text columns), so the server, the payment page
 * and the sender detail view share one authoritative calculation.
 */
export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = round2(
    (input.items ?? []).reduce((sum, item) => sum + round2(num(item.quantity) * num(item.unitAmount)), 0),
  );

  let discountAmount = 0;
  if (input.discountType === "percent") {
    discountAmount = round2(subtotal * Math.min(Math.max(num(input.discountValue), 0), 100) / 100);
  } else if (input.discountType === "fixed") {
    discountAmount = Math.min(round2(Math.max(num(input.discountValue), 0)), subtotal);
  }

  const taxableBase = round2(subtotal - discountAmount);
  const taxAmount = input.taxRate != null && input.taxRate !== ""
    ? round2(taxableBase * Math.min(Math.max(num(input.taxRate), 0), 100) / 100)
    : 0;

  return { subtotal, discountAmount, taxAmount, total: round2(taxableBase + taxAmount) };
}

// ─── Reminder eligibility ─────────────────────────────────────────────────────

/** Reminders fire at 9 a.m. local time on the relevant calendar day. */
export const REMINDER_HOUR = 9;

export interface ReminderEligibilityInput extends InvoiceStatusInput {
  sentAt: Date | null;
  dueReminderSentAt: Date | null;
  expiryReminderSentAt: Date | null;
}

/**
 * One Due Date reminder, sent on the Due Date itself (9 a.m. onward).
 * Never sent for Processing / Paid / Expired / Cancelled invoices, and never
 * after the due date's day has passed.
 */
export function isDueReminderEligible(inv: ReminderEligibilityInput, now: Date): boolean {
  if (!inv.dueDate || inv.dueReminderSentAt) return false;
  const status = deriveInvoiceStatus(inv, now);
  if (status !== "sent" && status !== "overdue") return false;
  const fireAt = zonedTimeOnDateUTC(inv.dueDate, REMINDER_HOUR, 0, 0, inv.expiryTimezone);
  const endOfDueDay = zonedEndOfDayUTC(inv.dueDate, inv.expiryTimezone);
  return now.getTime() >= fireAt.getTime() && now.getTime() <= endOfDueDay.getTime();
}

/**
 * One expiry reminder, three calendar days before expiry. Skipped entirely when
 * the invoice was generated fewer than three calendar days before expiry.
 */
export function isExpiryReminderEligible(inv: ReminderEligibilityInput, now: Date): boolean {
  if (inv.expiryReminderSentAt) return false;
  const status = deriveInvoiceStatus(inv, now);
  if (status !== "sent" && status !== "overdue") return false;

  const expiryDate = dateInTz(inv.expiresAt, inv.expiryTimezone);
  const reminderDate = addDays(expiryDate, -3);

  // Generated fewer than three calendar days before expiry → never remind.
  const sentDate = dateInTz(inv.sentAt ?? now, inv.expiryTimezone);
  if (sentDate >= reminderDate) return false;

  const fireAt = zonedTimeOnDateUTC(reminderDate, REMINDER_HOUR, 0, 0, inv.expiryTimezone);
  return now.getTime() >= fireAt.getTime() && now.getTime() < inv.expiresAt.getTime();
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-09-17" → "17 September 2026" (email/display copy). */
export function formatHumanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-09-17" → "17 Sep 2026" (compact table display). */
export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/** `formatDocumentNumber("INV", 1, "2026-08")` → `INV-202608-00001`. */
export function formatDocumentNumber(
  prefix: string,
  sequence: number,
  yearMonth: string,
): string {
  return `${prefix}-${yearMonth.replace("-", "")}-${String(sequence).padStart(5, "0")}`;
}

/** Invoice numbers: INV-YYYYMM-#####. */
export function formatInvoiceNumber(sequence: number, yearMonth: string): string {
  return formatDocumentNumber("INV", sequence, yearMonth);
}

export function clientDisplayName(client: {
  clientType: string;
  clientFirstName?: string | null;
  clientMiddleName?: string | null;
  clientLastName?: string | null;
  clientBusinessName?: string | null;
}): string {
  if (client.clientType === "business") return client.clientBusinessName ?? "";
  return [client.clientFirstName, client.clientMiddleName, client.clientLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}
