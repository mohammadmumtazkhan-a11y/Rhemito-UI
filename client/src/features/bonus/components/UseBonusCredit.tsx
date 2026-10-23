import { cn } from "@/lib/utils";
import { BONUS_COPY } from "../lib/copy";
import { amountConverted, availableParts, creditToApply, expiringSoon, formatMoney, formatUkDate, type BonusBalance, type BonusCredit } from "../lib/bonus";
import { BonusBlockedNotice } from "./BonusBlockedNotice";

export type BonusChoice = "none" | "pay_less" | "send_more";

interface UseBonusCreditProps {
  balance: BonusBalance;
  unused?: BonusCredit[];
  currency: string;
  sendAmount: number;
  receiveCurrency: string;
  exchangeRate: number;
  choice: BonusChoice;
  onChoice: (choice: BonusChoice) => void;
  blocked?: boolean;
  onContactSupport?: () => void;
  referralFloor?: number | null;
  schemeFloor?: number | null;
}

/** Send Money → Payment: "Use your bonus" (7.5). Checks currency and rule floor when present. */
export function UseBonusCredit({
  balance,
  unused = [],
  currency,
  sendAmount,
  receiveCurrency,
  exchangeRate,
  choice,
  onChoice,
  blocked,
  onContactSupport,
  referralFloor,
  schemeFloor,
}: UseBonusCreditProps) {
  const available = balance.available;
  if (!(available > 0)) return blocked ? <BonusBlockedNotice onContact={onContactSupport} /> : null;

  const currencyCredits = unused.filter((c) => c.currency === currency);
  const bySource = balance.by_source ?? [];
  const referralGroup = bySource.find((s) => s.credit_source === "REFERRAL");
  const schemeGroups = bySource.filter((s) => s.credit_source === "SCHEME" || s.credit_source === "MANUAL");

  const referralAvail = referralGroup?.available ?? 0;
  const schemeAvail = schemeGroups.reduce((sum, s) => sum + (s.available || 0), 0);

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

  const hasFloorRules = resolvedReferralFloor > 0 || resolvedSchemeFloor > 0;
  const referralBelowFloor = referralAvail > 0 && resolvedReferralFloor > 0 && sendAmount < resolvedReferralFloor;
  const schemeBelowFloor = schemeAvail > 0 && resolvedSchemeFloor > 0 && sendAmount < resolvedSchemeFloor;

  const eligibleAvailable = hasFloorRules
    ? (referralBelowFloor ? 0 : referralAvail) + (schemeBelowFloor ? 0 : schemeAvail) ||
      (!referralAvail && !schemeAvail && sendAmount >= Math.max(resolvedReferralFloor, resolvedSchemeFloor) ? available : 0)
    : available;

  const allBelowFloor = hasFloorRules && eligibleAvailable <= 0;
  const effectiveAvailable = hasFloorRules ? eligibleAvailable : available;

  const credit = creditToApply(effectiveAvailable > 0 ? effectiveAvailable : available, sendAmount, currency);
  const extra = amountConverted(credit, exchangeRate, receiveCurrency);
  const rest = credit < available ? `${formatMoney(Math.round((available - credit) * 100) / 100, currency)}` : undefined;
  const parts = availableParts(balance).map((p) => {
    const floorVal = p.source === "REFERRAL" ? resolvedReferralFloor : resolvedSchemeFloor;
    const floorSuffix = floorVal > 0 ? ` (min. ${formatMoney(floorVal, currency)})` : "";
    return `${formatMoney(p.available, currency)} from ${p.label === "Referrals" ? "referrals" : p.label === "Bonus offers" ? "bonus offers" : "Rhemito"}${floorSuffix}`;
  });
  const expiring = expiringSoon(currencyCredits)[0];
  const options: { id: BonusChoice; title: string; sub?: string; disabled?: boolean }[] = [
    { id: "pay_less", title: BONUS_COPY.payLess, sub: BONUS_COPY.payLessSub(formatMoney(credit, currency), rest), disabled: allBelowFloor },
    { id: "send_more", title: BONUS_COPY.sendMore, sub: BONUS_COPY.sendMoreSub(formatMoney(extra, receiveCurrency)), disabled: allBelowFloor },
    { id: "none", title: BONUS_COPY.dontUse },
  ];
  return (
    <div className="space-y-3">
      {blocked && <BonusBlockedNotice onContact={onContactSupport} />}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" data-testid="bonus-redemption" aria-labelledby="use-bonus-title">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 id="use-bonus-title" className="text-base font-bold text-slate-900">{BONUS_COPY.useTitle}</h2>
          <span className="text-sm font-bold text-teal-700">{BONUS_COPY.available(formatMoney(available, currency))}</span>
        </div>
        {parts.length > 0 && <p className="mb-3 text-[13px] text-slate-500" data-testid="bonus-includes">{BONUS_COPY.includes(parts)}</p>}
        {parts.length === 0 && <div className="mb-2" />}

        {referralAvail > 0 && resolvedReferralFloor > 0 && !referralBelowFloor && (
          <div className="mb-3 rounded-xl border border-teal-200 bg-teal-50/80 px-3.5 py-2.5 text-xs font-medium text-teal-900" data-testid="bonus-floor-met-notice">
            <p>
              You have earned <span className="font-bold">{formatMoney(referralAvail, currency)}</span> Referral Bonus credit (transfer is{" "}
              <span className="font-bold">{formatMoney(resolvedReferralFloor, currency)}</span> or more). Select <span className="font-bold">Pay less</span> or{" "}
              <span className="font-bold">Send more</span> below to use it.
            </p>
          </div>
        )}
        {(referralBelowFloor || schemeBelowFloor) && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs font-medium text-amber-900 space-y-1" data-testid="bonus-floor-notice">
            {referralBelowFloor && (
              <p>
                Send at least <span className="font-bold">{formatMoney(resolvedReferralFloor, currency)}</span> in <span className="font-bold">{currency}</span> to use your{" "}
                <span className="font-bold">{formatMoney(referralAvail, currency)}</span> Referral Bonus credit.
              </p>
            )}
            {schemeBelowFloor && (
              <p>
                Send at least <span className="font-bold">{formatMoney(resolvedSchemeFloor, currency)}</span> in <span className="font-bold">{currency}</span> to use your{" "}
                <span className="font-bold">{formatMoney(schemeAvail, currency)}</span> Bonus credit.
              </p>
            )}
          </div>
        )}

        <div role="radiogroup" aria-label="How to use your bonus" className="flex flex-col gap-2">
          {options.map((o) => {
            const selected = choice === o.id;
            return (
              <label
                key={o.id}
                className={cn(
                  "flex min-h-[56px] items-center gap-3 rounded-xl border px-3.5 transition-colors",
                  o.disabled ? "cursor-not-allowed opacity-60 bg-slate-50 border-slate-200" : "cursor-pointer hover:bg-slate-50",
                  selected ? "border-2 border-blue-600 bg-blue-50" : "border-slate-300 bg-white",
                )}
              >
                <input
                  type="radio"
                  name="bonus-choice"
                  value={o.id}
                  checked={selected}
                  disabled={o.disabled}
                  onChange={() => {
                    if (!o.disabled) onChoice(o.id);
                  }}
                  className="h-5 w-5 accent-blue-600"
                />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-semibold text-slate-900">{o.title}</span>
                  {o.sub && <span className="text-[13px] text-slate-600">{o.sub}</span>}
                </span>
              </label>
            );
          })}
        </div>

        {expiring?.expires_on && (
          <p className="mt-3 text-[13px] text-amber-800">{BONUS_COPY.expiryNote(formatMoney(expiring.remaining, expiring.currency), formatUkDate(expiring.expires_on))}</p>
        )}
      </section>
    </div>
  );
}
