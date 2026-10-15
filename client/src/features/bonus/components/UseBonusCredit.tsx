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
}

/** Send Money → Payment: "Use your bonus" (7.5). Whole balance, real currency, no minimum. */
export function UseBonusCredit({ balance, unused = [], currency, sendAmount, receiveCurrency, exchangeRate, choice, onChoice, blocked, onContactSupport }: UseBonusCreditProps) {
  const available = balance.available;
  if (!(available > 0)) return blocked ? <BonusBlockedNotice onContact={onContactSupport} /> : null;
  const credit = creditToApply(available, sendAmount, currency);
  const extra = amountConverted(credit, exchangeRate, receiveCurrency);
  const rest = credit < available ? `${formatMoney(Math.round((available - credit) * 100) / 100, currency)}` : undefined;
  const parts = availableParts(balance).map((p) => `${formatMoney(p.available, currency)} from ${p.label === "Referrals" ? "referrals" : p.label === "Bonus offers" ? "bonus offers" : "Rhemito"}`);
  const expiring = expiringSoon(unused.filter((c) => c.currency === currency))[0];
  const options: { id: BonusChoice; title: string; sub?: string }[] = [
    { id: "pay_less", title: BONUS_COPY.payLess, sub: BONUS_COPY.payLessSub(formatMoney(credit, currency), rest) },
    { id: "send_more", title: BONUS_COPY.sendMore, sub: BONUS_COPY.sendMoreSub(formatMoney(extra, receiveCurrency)) },
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

        <div role="radiogroup" aria-label="How to use your bonus" className="flex flex-col gap-2">
          {options.map((o) => {
            const selected = choice === o.id;
            return (
              <label
                key={o.id}
                className={cn(
                  "flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 transition-colors hover:bg-slate-50",
                  selected ? "border-2 border-blue-600 bg-blue-50" : "border-slate-300 bg-white",
                )}
              >
                <input type="radio" name="bonus-choice" value={o.id} checked={selected} onChange={() => onChoice(o.id)} className="h-5 w-5 accent-blue-600" />
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
