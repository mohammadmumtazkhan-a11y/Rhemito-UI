import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BONUS_COPY } from "../lib/copy";
import { formatUkDate, type BonusOffer } from "../lib/bonus";

/** Bonus & Discounts: live bonus offers in the customer's currency (7.4). Hidden when none, or when blocked. */
export function WaysToEarn({ offers, blocked }: { offers: BonusOffer[]; blocked?: boolean }) {
  if (blocked || offers.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="ways-to-earn-title" data-testid="ways-to-earn">
      <div>
        <h2 id="ways-to-earn-title" className="text-[15px] font-bold text-slate-900">{BONUS_COPY.waysToEarn}</h2>
        <p className="text-[13px] text-slate-500">{BONUS_COPY.waysToEarnSub}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {offers.map((o) => (
          <li key={o.id}>
            <Card className="flex h-full gap-3 rounded-2xl border border-slate-200 bg-white p-4" data-testid="offer-card">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600" aria-hidden>
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[15px] font-semibold text-slate-900">{o.name}</span>
                <span className="text-sm leading-5 text-slate-600">{o.summary}</span>
                {(o.end_date_display || o.end_date) && (
                  <span className="text-xs font-medium text-slate-500">{BONUS_COPY.ends(o.end_date_display || formatUkDate(o.end_date))}</span>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
