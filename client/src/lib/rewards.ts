/**
 * Referral & Bonus helpers shared by the Dashboard, Bonus & Discounts page,
 * sign-up and Send Money. Pure functions only — unit tested in rewards.test.ts.
 */

export interface RewardOffer {
  rule_id: number;
  currency: string;
  reward_type: "BOTH" | "REFERRER" | "REFEREE";
  referrer_reward: number;
  referee_reward: number;
  floor: number;
  qualification_window_days: number;
  bonus_validity_days: number;
  min_redeem_amount: number;
  text: string;
  referral_code?: string;
  referral_link?: string;
  cap_reached?: boolean;
}

export interface WalletBalance {
  currency: string;
  available: number;
  earned: number;
  used: number;
  expired: number;
  used_transfer_count: number;
  referral_credit_count: number;
  other_credit_count: number;
  /** Bonus module (one balance): money still owed from removed bonus, and the split by how it was earned. */
  outstanding_debt?: number;
  by_source?: Array<{ credit_source: "REFERRAL" | "SCHEME" | "MANUAL"; label?: string; earned: number; used: number; expired: number; removed: number; available: number }>;
}

/** How a credit was earned — present when Mito runs the bonus module. */
export interface CreditSourceFields {
  credit_source?: "REFERRAL" | "SCHEME" | "MANUAL" | null;
  credit_source_detail?: string | null;
  credit_source_label?: string | null;
  source_label?: string | null;
}

export interface WalletCredit extends CreditSourceFields {
  id: string;
  source: string | null;
  reason_code: string;
  amount: number;
  remaining: number;
  currency: string;
  earned_on: string;
  expires_on: string | null;
  status: "UNUSED" | "PARTLY_USED" | "USED" | "EXPIRED" | "REVERSED";
}

export interface WalletHistoryEntry extends CreditSourceFields {
  id: string;
  created_at: string;
  type: "EARNED" | "APPLIED" | "EXPIRED" | "VOIDED" | "CLAWBACK" | "CLAWBACK_SETTLED";
  reason_code: string;
  amount: number;
  currency: string;
  notes: string | null;
  transfer_id: string | null;
  source_credit_id: string | null;
}

/** What a customer is told when they are blocked from earning bonus. The reason stays with admins. */
export const BONUS_BLOCKED_MESSAGE = "You're not qualified to get bonus. Please contact support for more information.";

export interface Wallet {
  /** True when the customer cannot earn bonus until support approves them. */
  bonus_blocked?: boolean;
  balances: WalletBalance[];
  unused: WalletCredit[];
  credits: Array<Pick<WalletCredit, "id" | "amount" | "remaining" | "currency" | "status"> & { expires_on: string | null; notes: string | null; reason_code: string; created_at: string }>;
  history: WalletHistoryEntry[];
  promo_redemptions: Array<{ id: string; code: string; amount: number; currency: string | null; transfer_id: string; created_at: string }>;
}

export interface MyReferral {
  id: string;
  friend: string;
  joined_on: string;
  status: "REGISTERED" | "PENDING" | "REWARDED" | "EXPIRED" | "NOT_ELIGIBLE" | "REVERSED";
  status_label: string;
  currency: string;
  floor: number | null;
  qualification_deadline: string | null;
  reward: number;
  credited: number;
}

export interface RewardsSummary {
  customer: { id: string; referralCode: string; currency: string } | null;
  currency: string;
  offer: RewardOffer | null;
  wallet: Wallet;
  referrals: { data: MyReferral[]; summary: { joined: number; earned_count: number; total_earned: Record<string, number> } };
  latestOffer: { id: number; kind: string; title: string; message: string; createdAt: string } | null;
}

const SYMBOLS: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", NGN: "₦", INR: "₹", JPY: "¥", CNY: "¥", AUD: "A$", CAD: "C$", ZAR: "R", KES: "KSh ", GHS: "GH₵", AED: "AED ",
};

export function formatMoney(amount: number, currency: string): string {
  const dp = currency === "JPY" ? 0 : 2;
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
  const diff = Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(diff / 86_400_000);
}

/** "Expires in 9 days" / "Expires today" / "Expires tomorrow". */
export function expiryLabel(ymd: string | null | undefined, now: Date = new Date()): string {
  const d = daysUntil(ymd, now);
  if (d === null) return "";
  if (d <= 0) return "Expires today";
  if (d === 1) return "Expires tomorrow";
  return `Expires in ${d} days`;
}

/** Credits that expire within the warning window (14 days), soonest first. */
export function expiringSoon(credits: WalletCredit[], now: Date = new Date(), windowDays = 14): WalletCredit[] {
  return credits
    .filter((c) => c.remaining > 0 && c.expires_on && (daysUntil(c.expires_on, now) ?? 99) <= windowDays)
    .sort((a, b) => String(a.expires_on).localeCompare(String(b.expires_on)));
}

/** Balance for one currency (zeros when the customer has none). */
export function balanceFor(wallet: Wallet | undefined, currency: string): WalletBalance {
  return (
    wallet?.balances.find((b) => b.currency === currency) ?? {
      currency, available: 0, earned: 0, used: 0, expired: 0, used_transfer_count: 0, referral_credit_count: 0, other_credit_count: 0,
    }
  );
}

/** Progress segments filled (of 3) and tone for a referral's journey bar. */
export function referralStage(status: MyReferral["status"]): { filled: number; tone: "teal" | "primary" | "muted" } {
  switch (status) {
    case "REWARDED": return { filled: 3, tone: "teal" };
    case "PENDING": return { filled: 2, tone: "primary" };
    case "REGISTERED": return { filled: 1, tone: "primary" };
    default: return { filled: 3, tone: "muted" };
  }
}

/** Short status line shown next to a friend's name (US-2.3 table). */
export function referralStatusText(r: MyReferral, now: Date = new Date()): string {
  const floor = r.floor !== null && r.floor !== undefined ? formatMoney(r.floor, r.currency) : "";
  switch (r.status) {
    case "REWARDED": return r.credited > 0 ? `${formatMoney(r.credited, r.currency)} earned` : "Earned";
    case "PENDING": return "Transfer in progress";
    case "REGISTERED": {
      const left = daysUntil(r.qualification_deadline, now);
      return left !== null && left >= 0 ? `Joined · ${left} day${left === 1 ? "" : "s"} left` : "Joined";
    }
    case "EXPIRED": return `Didn't send ${floor || "the minimum"} in time`;
    case "NOT_ELIGIBLE": return "Not eligible";
    case "REVERSED": return "Transfer refunded";
    default: return r.status_label;
  }
}

/** Longer help line used on the My referrals tab. */
export function referralHelpText(r: MyReferral, now: Date = new Date()): string {
  const floor = r.floor !== null && r.floor !== undefined ? formatMoney(r.floor, r.currency) : "the minimum amount";
  switch (r.status) {
    case "REGISTERED": {
      const left = daysUntil(r.qualification_deadline, now);
      return `Waiting for their first transfer of ${floor} or more${left !== null && left >= 0 ? ` · ${left} day${left === 1 ? "" : "s"} left` : ""}`;
    }
    case "PENDING": return `Transfer in progress – you get ${formatMoney(r.reward, r.currency)} when it completes`;
    case "REWARDED": return r.credited > 0 ? `${formatMoney(r.credited, r.currency)} added to your bonus credit` : "Your friend received their bonus";
    case "EXPIRED": return `They didn't send ${floor} or more in time`;
    case "NOT_ELIGIBLE": return "This referral didn't meet the programme terms";
    case "REVERSED": return "The qualifying transfer was refunded";
    default: return r.status_label;
  }
}

/** Customer-facing status of a credit or history line. */
export const CREDIT_STATUS_LABEL: Record<WalletCredit["status"], string> = {
  UNUSED: "Unused", PARTLY_USED: "Partly used", USED: "Used", EXPIRED: "Expired", REVERSED: "Reversed",
};

/** Bonus applicable to a transfer: never more than the balance or the send amount. */
export function bonusToApply(available: number, sendAmount: number): number {
  if (!(available > 0) || !(sendAmount > 0)) return 0;
  return Math.round(Math.min(available, sendAmount) * 100) / 100;
}

/** Total to pay after promo and Pay-less bonus; never below 0. */
export function totalToPay(sendAmount: number, fee: number, promoDiscount: number, payLessBonus: number): number {
  return Math.max(0, Math.round((sendAmount + fee - promoDiscount - payLessBonus) * 100) / 100);
}

// ─── Referral code captured from a /ref link (kept 30 days, AC-3.1.2) ────────

const REF_KEY = "rhemito.referral";
const REF_TTL_MS = 30 * 86_400_000;
export const REFERRAL_CODE_RE = /^[A-Z0-9]{6,12}$/;

export interface StoredReferral { code: string; referrerFirstName?: string; savedAt: number; offer?: RewardOffer | null }

export function saveReferral(ref: Omit<StoredReferral, "savedAt">, now = Date.now()): void {
  try { localStorage.setItem(REF_KEY, JSON.stringify({ ...ref, savedAt: now })); } catch { /* storage unavailable */ }
}

export function loadReferral(now = Date.now()): StoredReferral | null {
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const ref = JSON.parse(raw) as StoredReferral;
    if (!ref.code || now - ref.savedAt > REF_TTL_MS) {
      localStorage.removeItem(REF_KEY);
      return null;
    }
    return ref;
  } catch {
    return null;
  }
}

export function clearReferral(): void {
  try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ }
}

export function visitorId(): string {
  try {
    const key = "rhemito.visitorId";
    let id = localStorage.getItem(key);
    if (!id) {
      id = `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}
