import { cn } from "@/lib/utils";
import { bonusToApply, formatMoney, formatUkDate, type WalletCredit } from "@/lib/rewards";

export type BonusChoice = "none" | "pay_less" | "send_more";

interface BonusRedemptionProps {
  available: number;
  currency: string;
  sendAmount: number;
  receiveCurrency: string;
  exchangeRate: number;
  minRedeem: number;
  expiringCredit?: WalletCredit;
  choice: BonusChoice;
  onChoice: (choice: BonusChoice) => void;
}

/** Send Money → Payment: "Use your bonus" card (spec §6, US-5.2 / US-5.3). */
export function BonusRedemption({ available, currency, sendAmount, receiveCurrency, exchangeRate, minRedeem, expiringCredit, choice, onChoice }: BonusRedemptionProps) {
  if (!(available > 0)) return null;
  const bonus = bonusToApply(available, sendAmount);
  const belowMin = minRedeem > 0 && sendAmount < minRedeem;
  const extra = bonus * exchangeRate;
  const options: { id: BonusChoice; title: string; sub?: string }[] = [
    { id: "pay_less", title: "Pay less", sub: `Save ${formatMoney(bonus, currency)} now${bonus < available ? `. ${formatMoney(available - bonus, currency)} will stay in your bonus credit.` : ""}` },
    { id: "send_more", title: "Send more", sub: `Recipient gets ${formatMoney(extra, receiveCurrency)} more` },
    { id: "none", title: "Don't use bonus" },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" data-testid="bonus-redemption" aria-labelledby="use-bonus-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="use-bonus-title" className="text-base font-bold text-slate-900">Use your bonus</h2>
        <span className="text-sm font-bold text-teal-700">{formatMoney(available, currency)} available</span>
      </div>

      {belowMin && (
        <p className="mb-3 text-sm text-slate-700" data-testid="bonus-below-min">
          Send {formatMoney(minRedeem, currency)} or more to use your {formatMoney(available, currency)} bonus.
        </p>
      )}

      <div role="radiogroup" aria-label="How to use your bonus" className="flex flex-col gap-2">
        {options.map((o) => {
          const selected = choice === o.id;
          const disabled = belowMin && o.id !== "none";
          return (
            <label
              key={o.id}
              className={cn(
                "flex min-h-[56px] items-center gap-3 rounded-xl border px-3.5 transition-colors",
                selected ? "border-2 border-blue-600 bg-blue-50" : "border-slate-300 bg-white",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="bonus-choice"
                value={o.id}
                checked={selected}
                disabled={disabled}
                onChange={() => onChoice(o.id)}
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

      {expiringCredit && expiringCredit.expires_on && (
        <p className="mt-3 text-[13px] text-amber-800">
          {formatMoney(expiringCredit.remaining, expiringCredit.currency)} of this expires on {formatUkDate(expiringCredit.expires_on)} – it&apos;s used first.
        </p>
      )}
    </section>
  );
}
