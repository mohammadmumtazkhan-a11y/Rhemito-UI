/**
 * Bonus credit helpers (BONUS_MODULE_SPEC_RHEMITO.md §8). Pure functions, unit tested.
 * This module imports nothing from referral or promo code.
 */

export type CreditSource = "REFERRAL" | "SCHEME" | "MANUAL";
export type CreditStatus = "UNUSED" | "PARTLY_USED" | "USED" | "EXPIRED" | "REVERSED";

export interface SourceTotals {
  credit_source: CreditSource;
  label?: string;
  earned: number;
  used: number;
  expired: number;
  removed: number;
  available: number;
  floor?: number;
  receive_currency?: string | null;
}

export interface BonusBalance {
  currency: string;
  available: number;
  earned: number;
  used: number;
  expired: number;
  used_transfer_count: number;
  referral_credit_count: number;
  other_credit_count: number;
  outstanding_debt?: number;
  /** Absent when Mito is an older version — everything then reads as one balance. */
  by_source?: SourceTotals[];
}

export interface SourceFields {
  credit_source?: CreditSource | null;
  credit_source_detail?: string | null;
  credit_source_label?: string | null;
  source_label?: string | null;
}

export interface BonusCredit extends SourceFields {
  id: string;
  /** Ledger note written when the credit was issued. */
  source: string | null;
  reason_code: string;
  amount: number;
  remaining: number;
  currency: string;
  earned_on: string;
  expires_on: string | null;
  status: CreditStatus;
  floor?: number;
  receive_currency?: string | null;
}

export interface BonusWallet {
  bonus_blocked?: boolean;
  balances: BonusBalance[];
  unused: BonusCredit[];
}

export interface BonusOffer {
  id: number | string;
  name: string;
  type?: string;
  currency: string;
  summary: string;
  end_date?: string | null;
  end_date_display?: string | null;
  min_transaction_threshold?: number;
  floor?: number;
}

// ─── Money & dates ───────────────────────────────────────────────────────────

const SYMBOLS: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", NGN: "₦", INR: "₹", JPY: "¥", CNY: "¥", AUD: "A$", CAD: "C$", ZAR: "R", KES: "KSh ", GHS: "GH₵", AED: "AED ",
};

export const decimalsFor = (currency: string) => (currency === "JPY" ? 0 : 2);

export function round(amount: number, currency: string): number {
  const f = 10 ** decimalsFor(currency);
  return Math.round((Number(amount) || 0) * f + Number.EPSILON) / f;
}

export function formatMoney(amount: number, currency: string): string {
  const dp = decimalsFor(currency);
  const n = Number(amount || 0);
  const sign = n < 0 ? "−" : "";
  return `${sign}${SYMBOLS[currency] ?? `${currency} `}${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

/** YYYY-MM-DD or ISO → DD/MM/YYYY (UK time). */
export function formatUkDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("/");
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
}

/** Whole days from today (UK) until a YYYY-MM-DD date; negative when past. */
export function daysUntil(ymd: string | null | undefined, now: Date = new Date()): number | null {
  if (!ymd) return null;
  const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return Math.round((Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function expiryLabel(ymd: string | null | undefined, now: Date = new Date()): string {
  const d = daysUntil(ymd, now);
  if (d === null) return "";
  if (d <= 0) return "Expires today";
  if (d === 1) return "Expires tomorrow";
  return `Expires in ${d} days`;
}

/** Credits that expire within the warning window (14 days), soonest first. */
export function expiringSoon<T extends { remaining: number; expires_on: string | null }>(credits: T[], now: Date = new Date(), windowDays = 14): T[] {
  return credits
    .filter((c) => c.remaining > 0 && c.expires_on && (daysUntil(c.expires_on, now) ?? 99) <= windowDays)
    .sort((a, b) => String(a.expires_on).localeCompare(String(b.expires_on)));
}

export function balanceFor(wallet: Pick<BonusWallet, "balances"> | undefined, currency: string): BonusBalance {
  return (
    wallet?.balances?.find((b) => b.currency === currency) ?? {
      currency, available: 0, earned: 0, used: 0, expired: 0, used_transfer_count: 0, referral_credit_count: 0, other_credit_count: 0,
    }
  );
}

// ─── Using bonus on a transfer ───────────────────────────────────────────────

/** Bonus applicable to a transfer: never more than the whole balance (all sources) or the send amount. */
/** Available bonus credit eligible for `sendAmount` and `receiveCurrency` based on each source's corridor and floor (`min_transaction_threshold`). */
export function eligibleBonusBalance(
  wallet: BonusBalance,
  sendAmount: number,
  referralFloor?: number | null,
  receiveCurrency?: string | null,
  referralReceiveCurrency?: string | null,
): number {
  const bySource = wallet.by_source ?? [];
  if (!bySource.length) {
    const corridorMismatch =
      Boolean(referralReceiveCurrency) &&
      Boolean(receiveCurrency) &&
      referralReceiveCurrency!.toUpperCase() !== receiveCurrency!.toUpperCase();
    if (corridorMismatch) return 0;
    if (referralFloor && referralFloor > 0 && sendAmount < referralFloor) return 0;
    return wallet.available;
  }
  let total = 0;
  let anyRestriction = false;
  for (const s of bySource) {
    const floor = s.credit_source === "REFERRAL" ? (s.floor || referralFloor || 0) : (s.floor || 0);
    const reqReceive = s.credit_source === "REFERRAL" ? (s.receive_currency || referralReceiveCurrency || null) : null;
    if (floor > 0 || reqReceive) anyRestriction = true;
    const corridorOk = !reqReceive || !receiveCurrency || reqReceive.toUpperCase() === receiveCurrency.toUpperCase();
    const floorOk = sendAmount >= floor;
    if (corridorOk && floorOk) total += s.available || 0;
  }
  return anyRestriction ? round(total, wallet.currency) : wallet.available;
}

export function creditToApply(available: number, sendAmount: number, currency = "GBP"): number {
  if (!(available > 0) || !(sendAmount > 0)) return 0;
  return round(Math.min(available, sendAmount), currency);
}

/** Total to pay after promo and Pay-less bonus; never below 0. */
export function totalToPay(sendAmount: number, fee: number, promoDiscount: number, payLessBonus: number, currency = "GBP"): number {
  return Math.max(0, round(sendAmount + fee - promoDiscount - payLessBonus, currency));
}

/** What the recipient gets extra when the bonus is added to the send amount. */
export function amountConverted(sendMoreCredit: number, exchangeRate: number, receiveCurrency: string): number {
  if (!(sendMoreCredit > 0) || !(exchangeRate > 0)) return 0;
  return round(sendMoreCredit * exchangeRate, receiveCurrency);
}

// ─── Sources ─────────────────────────────────────────────────────────────────

export const SOURCE_ORDER: CreditSource[] = ["REFERRAL", "SCHEME", "MANUAL"];

export function sourceGroupLabel(source: string | null | undefined): string {
  switch (source) {
    case "REFERRAL": return "Referrals";
    case "SCHEME": return "Bonus offers";
    case "MANUAL": return "From Rhemito";
    default: return "";
  }
}

export function isCreditSource(v: unknown): v is CreditSource {
  return v === "REFERRAL" || v === "SCHEME" || v === "MANUAL";
}

export interface BreakdownRow {
  source: CreditSource;
  label: string;
  earned: number;
  available: number;
  /** Share of total earned, 0–100. */
  share: number;
}

/** One row per source with anything earned; shares add up to 100 and amounts to the tiles. */
export function breakdownRows(balance: Pick<BonusBalance, "by_source" | "earned">): BreakdownRow[] {
  const groups = (balance.by_source ?? []).filter((g) => g.earned > 0);
  const total = groups.reduce((s, g) => s + g.earned, 0);
  const rows = SOURCE_ORDER.flatMap((source) => {
    const g = groups.find((x) => x.credit_source === source);
    return g ? [{ source, label: sourceGroupLabel(source), earned: g.earned, available: g.available, share: total > 0 ? (g.earned / total) * 100 : 0 }] : [];
  });
  return rows;
}

/** The "Includes … from …" parts for the Send Money card, in a fixed order. Empty when only one source holds credit. */
export function availableParts(balance: Pick<BonusBalance, "by_source">): Array<{ source: CreditSource; label: string; available: number }> {
  const parts = SOURCE_ORDER.flatMap((source) => {
    const g = (balance.by_source ?? []).find((x) => x.credit_source === source);
    return g && g.available > 0 ? [{ source, label: sourceGroupLabel(source), available: g.available }] : [];
  });
  return parts.length > 1 ? parts : [];
}

/** Crystal-clear first-person customer-facing description (no Referrer/Referee jargon). */
export function describeCredit(row: { credit_source_label?: string | null; source_label?: string | null; notes?: string | null; source?: string | null; reason_code?: string | null; referrer_name?: string | null; referrer_email?: string | null }): string {
  const inviter = (row.referrer_name || row.referrer_email || "").trim();
  const replaceGeneric = (s: string) => (inviter ? s.replace(/(invited by\s+)(friend|Customer|your friend)\b/i, `$1${inviter}`) : s);
  const clarifyFirstPerson = (s: string) => {
    const cleaned = s.replace(/ \(approved by.*\)$/, "");
    if (/^Referrer reward – referred (.+)$/i.test(cleaned)) {
      return cleaned.replace(/^Referrer reward – referred (.+)$/i, "Referral bonus – You earned from referring $1");
    }
    if (/^Referral bonus – (?!You earned)(.+)$/i.test(cleaned)) {
      return cleaned.replace(/^Referral bonus – (.+)$/i, "Referral bonus – You earned from referring $1");
    }
    if (/^Referee reward – invited by (.+)$/i.test(cleaned)) {
      return cleaned.replace(/^Referee reward – invited by (.+)$/i, "Welcome bonus – You earned (invited by $1)");
    }
    if (/^Welcome bonus – invited by (.+)$/i.test(cleaned)) {
      return cleaned.replace(/^Welcome bonus – invited by (.+)$/i, "Welcome bonus – You earned (invited by $1)");
    }
    return cleaned;
  };
  const label = clarifyFirstPerson(replaceGeneric(row.credit_source_label ?? row.source_label ?? ""));
  if (label) return row.reason_code === "BONUS_RETURNED" && !/returned/i.test(label) ? `${label} (returned after a cancelled transfer)` : label;
  const n = clarifyFirstPerson(replaceGeneric((row.notes ?? row.source ?? "") || ""));
  if (row.reason_code === "BONUS_RETURNED") return "Bonus returned – transfer cancelled";
  return n || "Bonus credit";
}

export const CREDIT_STATUS_LABEL: Record<CreditStatus, string> = {
  UNUSED: "Unused", PARTLY_USED: "Partly used", USED: "Used", EXPIRED: "Expired", REVERSED: "Reversed",
};

/** Filter rows by source; rows without a source (older Mito) only show under "All sources". */
export function bySource<T extends { credit_source?: string | null }>(rows: T[], source: CreditSource | "ALL"): T[] {
  return source === "ALL" ? rows : rows.filter((r) => r.credit_source === source);
}
