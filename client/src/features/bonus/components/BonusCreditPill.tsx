import { ArrowRight, Gift, Users } from "lucide-react";
import { BONUS_COPY } from "../lib/copy";
import { daysUntil, expiringSoon, formatMoney, type BonusBalance, type BonusCredit } from "../lib/bonus";

interface BonusCreditPillProps {
  balance: BonusBalance;
  unused?: BonusCredit[];
  referralFloor?: number | null;
  schemeFloor?: number | null;
  onCreateTransaction: (rewardType?: "referral" | "bonus") => void;
}

/** Dashboard: structured rows for Referral bonus and Bonus credit inside the "Your bonus credits" card. Hidden at 0. */
export function BonusCreditPill({
  balance,
  unused = [],
  referralFloor,
  schemeFloor,
  onCreateTransaction,
}: BonusCreditPillProps) {
  if (!(balance.available > 0)) return null;

  const currencyCredits = unused.filter((c) => c.currency === balance.currency);
  const bySource = balance.by_source ?? [];
  const referralGroup = bySource.find((s) => s.credit_source === "REFERRAL");
  const schemeGroups = bySource.filter((s) => s.credit_source === "SCHEME" || s.credit_source === "MANUAL");

  const referralAvailable = referralGroup?.available ?? 0;
  const schemeAvailable = schemeGroups.reduce((sum, s) => sum + (s.available || 0), 0);
  const hasSourceSplit = referralAvailable + schemeAvailable > 0;

  // Floor from backend rule (referral_rules.min_transaction_threshold and bonus_schemes.min_transaction_threshold)
  const resolvedReferralFloor =
    referralGroup?.floor ||
    referralFloor ||
    currencyCredits.find((c) => c.credit_source === "REFERRAL" && (c.floor ?? 0) > 0)?.floor ||
    0;

  const resolvedSchemeFloor = Math.max(
    0,
    schemeFloor ?? 0,
    ...schemeGroups.map((s) => s.floor || 0),
    ...currencyCredits.filter((c) => c.credit_source !== "REFERRAL").map((c) => c.floor || 0),
  );

  // Fallback when by_source is absent (e.g. unit test fixture with total balance only)
  if (!hasSourceSplit) {
    const soon = expiringSoon(currencyCredits)[0];
    const days = soon ? Math.max(0, daysUntil(soon.expires_on) ?? 0) : null;
    const fallbackFloor = resolvedSchemeFloor || resolvedReferralFloor || 0;
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50/40 divide-y divide-slate-100">
        <div
          data-testid="bonus-earned-pill"
          className="flex items-center justify-between gap-3.5 px-4 py-3.5"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600">Bonus credit</p>
              <p className="text-xl font-bold text-slate-900 leading-tight mt-0.5">
                {formatMoney(balance.available, balance.currency)}
                <span className="sr-only"> bonus credit</span>
              </p>
              <p className="text-[13px] text-slate-500 mt-0.5">
                {fallbackFloor > 0 ? `Minimum transfer ${formatMoney(fallbackFloor, balance.currency)}` : "Ready to use on your next transfer"}
                {soon && days !== null && (
                  <span className="ml-1.5 font-semibold text-amber-700" data-testid="bonus-pill-expiring">
                    {days === 0
                      ? BONUS_COPY.pillExpiringToday(formatMoney(soon.remaining, soon.currency))
                      : BONUS_COPY.pillExpiring(formatMoney(soon.remaining, soon.currency), days)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCreateTransaction()}
            className="inline-flex items-center gap-1 text-[13px] sm:text-sm font-semibold text-blue-600 hover:text-blue-700 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <span>{BONUS_COPY.pillCta}</span>
            <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const refSoon = expiringSoon(currencyCredits.filter((c) => c.credit_source === "REFERRAL"))[0];
  const refDays = refSoon ? Math.max(0, daysUntil(refSoon.expires_on) ?? 0) : null;

  const schemeSoon = expiringSoon(currencyCredits.filter((c) => c.credit_source !== "REFERRAL"))[0];
  const schemeDays = schemeSoon ? Math.max(0, daysUntil(schemeSoon.expires_on) ?? 0) : null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/40 divide-y divide-slate-100">
      {referralAvailable > 0 && (
        <div
          data-testid={schemeAvailable > 0 ? "referral-bonus-earned-pill" : "bonus-earned-pill"}
          className="flex items-center justify-between gap-3.5 px-4 py-3.5"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600">Referral bonus</p>
              <p className="text-xl font-bold text-slate-900 leading-tight mt-0.5">
                {formatMoney(referralAvailable, balance.currency)}
                <span className="sr-only"> bonus credit</span>
              </p>
              <p className="text-[13px] text-slate-500 mt-0.5">
                {resolvedReferralFloor > 0
                  ? `Minimum transfer ${formatMoney(resolvedReferralFloor, balance.currency)}`
                  : "Ready to use on your next transfer"}
                {refSoon && refDays !== null && (
                  <span
                    className="ml-1.5 font-semibold text-amber-700"
                    data-testid={schemeAvailable > 0 && schemeSoon ? "referral-pill-expiring" : "bonus-pill-expiring"}
                  >
                    {refDays === 0
                      ? BONUS_COPY.pillExpiringToday(formatMoney(refSoon.remaining, refSoon.currency))
                      : BONUS_COPY.pillExpiring(formatMoney(refSoon.remaining, refSoon.currency), refDays)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCreateTransaction("referral")}
            data-testid="create-txn-referral-btn"
            className="inline-flex items-center gap-1 text-[13px] sm:text-sm font-semibold text-blue-600 hover:text-blue-700 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <span>{BONUS_COPY.pillCta}</span>
            <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}

      {schemeAvailable > 0 && (
        <div
          data-testid="bonus-earned-pill"
          className="flex items-center justify-between gap-3.5 px-4 py-3.5"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600">Bonus credit</p>
              <p className="text-xl font-bold text-slate-900 leading-tight mt-0.5">
                {formatMoney(schemeAvailable, balance.currency)}
                <span className="sr-only"> bonus credit</span>
              </p>
              <p className="text-[13px] text-slate-500 mt-0.5">
                {resolvedSchemeFloor > 0
                  ? `Minimum transfer ${formatMoney(resolvedSchemeFloor, balance.currency)}`
                  : "Ready to use on your next transfer"}
                {schemeSoon && schemeDays !== null && (
                  <span className="ml-1.5 font-semibold text-amber-700" data-testid="bonus-pill-expiring">
                    {schemeDays === 0
                      ? BONUS_COPY.pillExpiringToday(formatMoney(schemeSoon.remaining, schemeSoon.currency))
                      : BONUS_COPY.pillExpiring(formatMoney(schemeSoon.remaining, schemeSoon.currency), schemeDays)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCreateTransaction("bonus")}
            data-testid="create-txn-bonus-btn"
            className="inline-flex items-center gap-1 text-[13px] sm:text-sm font-semibold text-blue-600 hover:text-blue-700 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <span>{BONUS_COPY.pillCta}</span>
            <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
