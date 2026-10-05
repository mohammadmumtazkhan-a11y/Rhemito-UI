import { Info } from "lucide-react";
import { BONUS_BLOCKED_MESSAGE } from "@/lib/rewards";

/** Shown when Mito Admin has blocked the customer from earning bonus. The reason is for admins only. */
export function BonusBlockedNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[14px] leading-[21px] text-amber-900 ${className}`}
      data-testid="bonus-blocked-notice"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{BONUS_BLOCKED_MESSAGE}</p>
    </div>
  );
}
