import { Link } from "wouter";
import { expiringSoon, formatMoney, expiryLabel, type WalletBalance, type WalletCredit } from "@/lib/rewards";

interface BonusCreditCardProps {
  balance: WalletBalance;
  unused: WalletCredit[];
}

/** Dashboard bonus credit card — hidden when nothing is available (spec §3). */
export function BonusCreditCard({ balance, unused }: BonusCreditCardProps) {
  if (!(balance.available > 0)) return null;
  const soon = expiringSoon(unused.filter((c) => c.currency === balance.currency))[0];
  return (
    <Link
      href="/bonus-discounts"
      data-testid="bonus-credit-card"
      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-inherit no-underline transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-slate-500">Bonus credit ready to use</span>
        <span className="font-display text-[22px] font-extrabold text-slate-900">{formatMoney(balance.available, balance.currency)}</span>
        {soon && (
          <span className="text-[13px] text-amber-800">
            {formatMoney(soon.remaining, soon.currency)} {expiryLabel(soon.expires_on).replace(/^E/, "e")}
          </span>
        )}
      </div>
      <span className="text-[15px] font-semibold text-blue-600">Send money</span>
    </Link>
  );
}
