import { Gift } from "lucide-react";
import { motion } from "framer-motion";
import { BONUS_COPY } from "../lib/copy";
import { daysUntil, expiringSoon, formatMoney, type BonusBalance, type BonusCredit } from "../lib/bonus";

interface BonusCreditPillProps {
  balance: BonusBalance;
  unused?: BonusCredit[];
  onCreateTransaction: () => void;
}

/** Dashboard: one pill for the one bonus balance (7.1). Hidden at 0. */
export function BonusCreditPill({ balance, unused = [], onCreateTransaction }: BonusCreditPillProps) {
  if (!(balance.available > 0)) return null;
  const soon = expiringSoon(unused.filter((c) => c.currency === balance.currency))[0];
  const days = soon ? Math.max(0, daysUntil(soon.expires_on) ?? 0) : null;
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
        You have <span className="font-bold text-purple-900">{formatMoney(balance.available, balance.currency)} bonus credit</span>.{" "}
        <button type="button" onClick={onCreateTransaction} className="font-semibold underline underline-offset-2 hover:text-purple-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
          {BONUS_COPY.pillCta}
        </button>{" "}
        {BONUS_COPY.pillCtaSuffix}
        {soon && days !== null && (
          <span className="ml-1 font-semibold text-amber-700" data-testid="bonus-pill-expiring">
            {days === 0 ? BONUS_COPY.pillExpiringToday(formatMoney(soon.remaining, soon.currency)) : BONUS_COPY.pillExpiring(formatMoney(soon.remaining, soon.currency), days)}
          </span>
        )}
      </span>
    </motion.div>
  );
}
