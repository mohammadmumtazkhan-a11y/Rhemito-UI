import { Gift, Users } from "lucide-react";
import { motion } from "framer-motion";
import { BONUS_COPY } from "../lib/copy";
import { daysUntil, expiringSoon, formatMoney, type BonusBalance, type BonusCredit } from "../lib/bonus";

interface BonusCreditPillProps {
  balance: BonusBalance;
  unused?: BonusCredit[];
  referralFloor?: number | null;
  schemeFloor?: number | null;
  onCreateTransaction: () => void;
}

/** Dashboard: separate pills for Referral Bonus credit and Bonus Scheme credit, each showing its backend floor rule. Hidden at 0. */
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
      <motion.div
        whileHover={{ scale: 1.01, y: -1 }}
        data-testid="bonus-earned-pill"
        className="flex items-center gap-2.5 bg-gradient-to-r from-purple-50 via-pink-50/70 to-purple-50 text-purple-700 px-3.5 py-2.5 sm:px-4 sm:py-2 rounded-2xl sm:rounded-full border border-purple-200/70 shadow-xs backdrop-blur-sm self-start md:self-auto max-w-full"
      >
        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-xs shrink-0">
          <Gift className="w-3.5 h-3.5 text-pink-500" aria-hidden />
        </div>
        <span className="text-xs md:text-sm font-medium leading-snug">
          You have <span className="font-bold text-purple-900">{formatMoney(balance.available, balance.currency)} bonus credit</span>
          {fallbackFloor > 0 && (
            <span className="text-purple-800">
              {" "}(min. transfer <span className="font-bold text-purple-900">{formatMoney(fallbackFloor, balance.currency)}</span>)
            </span>
          )}
          .{" "}
          <button
            type="button"
            onClick={onCreateTransaction}
            className="font-semibold underline underline-offset-2 hover:text-purple-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            {BONUS_COPY.pillCta}
          </button>{" "}
          {BONUS_COPY.pillCtaSuffix}
          {soon && days !== null && (
            <span className="ml-1 font-semibold text-amber-700" data-testid="bonus-pill-expiring">
              {days === 0
                ? BONUS_COPY.pillExpiringToday(formatMoney(soon.remaining, soon.currency))
                : BONUS_COPY.pillExpiring(formatMoney(soon.remaining, soon.currency), days)}
            </span>
          )}
        </span>
      </motion.div>
    );
  }

  const refSoon = expiringSoon(currencyCredits.filter((c) => c.credit_source === "REFERRAL"))[0];
  const refDays = refSoon ? Math.max(0, daysUntil(refSoon.expires_on) ?? 0) : null;

  const schemeSoon = expiringSoon(currencyCredits.filter((c) => c.credit_source !== "REFERRAL"))[0];
  const schemeDays = schemeSoon ? Math.max(0, daysUntil(schemeSoon.expires_on) ?? 0) : null;

  return (
    <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto max-w-full">
      {referralAvailable > 0 && (
        <motion.div
          whileHover={{ scale: 1.01, y: -1 }}
          data-testid={schemeAvailable > 0 ? "referral-bonus-earned-pill" : "bonus-earned-pill"}
          className="flex items-center gap-2.5 bg-gradient-to-r from-indigo-50 via-teal-50/70 to-indigo-50 text-indigo-800 px-3.5 py-2.5 sm:px-4 sm:py-2 rounded-2xl sm:rounded-full border border-indigo-200/70 shadow-xs backdrop-blur-sm max-w-full"
        >
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-xs shrink-0">
            <Users className="w-3.5 h-3.5 text-teal-600" aria-hidden />
          </div>
          <span className="text-xs md:text-sm font-medium leading-snug">
            You have <span className="font-bold text-indigo-950">{formatMoney(referralAvailable, balance.currency)} Referral Bonus credit</span>
            {resolvedReferralFloor > 0 && (
              <span className="text-indigo-900">
                {" "}(min. transfer <span className="font-bold text-indigo-950">{formatMoney(resolvedReferralFloor, balance.currency)}</span>)
              </span>
            )}
            .{" "}
            <button
              type="button"
              onClick={onCreateTransaction}
              className="font-semibold underline underline-offset-2 hover:text-indigo-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              {BONUS_COPY.pillCta}
            </button>{" "}
            {BONUS_COPY.pillCtaSuffix}
            {refSoon && refDays !== null && (
              <span
                className="ml-1 font-semibold text-amber-700"
                data-testid={schemeAvailable > 0 && schemeSoon ? "referral-pill-expiring" : "bonus-pill-expiring"}
              >
                {refDays === 0
                  ? BONUS_COPY.pillExpiringToday(formatMoney(refSoon.remaining, refSoon.currency))
                  : BONUS_COPY.pillExpiring(formatMoney(refSoon.remaining, refSoon.currency), refDays)}
              </span>
            )}
          </span>
        </motion.div>
      )}

      {schemeAvailable > 0 && (
        <motion.div
          whileHover={{ scale: 1.01, y: -1 }}
          data-testid="bonus-earned-pill"
          className="flex items-center gap-2.5 bg-gradient-to-r from-purple-50 via-pink-50/70 to-purple-50 text-purple-700 px-3.5 py-2.5 sm:px-4 sm:py-2 rounded-2xl sm:rounded-full border border-purple-200/70 shadow-xs backdrop-blur-sm max-w-full"
        >
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-xs shrink-0">
            <Gift className="w-3.5 h-3.5 text-pink-500" aria-hidden />
          </div>
          <span className="text-xs md:text-sm font-medium leading-snug">
            You have <span className="font-bold text-purple-900">{formatMoney(schemeAvailable, balance.currency)} bonus credit</span>
            {resolvedSchemeFloor > 0 && (
              <span className="text-purple-800">
                {" "}(min. transfer <span className="font-bold text-purple-900">{formatMoney(resolvedSchemeFloor, balance.currency)}</span>)
              </span>
            )}
            .{" "}
            <button
              type="button"
              onClick={onCreateTransaction}
              className="font-semibold underline underline-offset-2 hover:text-purple-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              {BONUS_COPY.pillCta}
            </button>{" "}
            {BONUS_COPY.pillCtaSuffix}
            {schemeSoon && schemeDays !== null && (
              <span className="ml-1 font-semibold text-amber-700" data-testid="bonus-pill-expiring">
                {schemeDays === 0
                  ? BONUS_COPY.pillExpiringToday(formatMoney(schemeSoon.remaining, schemeSoon.currency))
                  : BONUS_COPY.pillExpiring(formatMoney(schemeSoon.remaining, schemeSoon.currency), schemeDays)}
              </span>
            )}
          </span>
        </motion.div>
      )}
    </div>
  );
}
