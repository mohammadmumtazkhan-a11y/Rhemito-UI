import { cn } from "@/lib/utils";
import { referralStage, referralStatusText, type MyReferral } from "@/lib/rewards";

interface ReferralProgressRowProps {
  referral: MyReferral;
}

/** One friend's three-stage journey: Joined → Sent £50+ → Earned (spec §2). */
export function ReferralProgressRow({ referral }: ReferralProgressRowProps) {
  const { filled, tone } = referralStage(referral.status);
  const fill = tone === "teal" ? "bg-teal" : tone === "primary" ? "bg-primary" : "bg-slate-300";
  const status = referralStatusText(referral);
  return (
    <div className="flex flex-col gap-2" data-testid={`referral-progress-${referral.id}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold text-slate-900">{referral.friend}</span>
        <span
          className={cn(
            "text-sm text-right",
            tone === "teal" ? "font-bold text-teal-700" : tone === "primary" ? "text-blue-700" : "text-slate-600",
          )}
        >
          {status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1" role="img" aria-label={`${referral.friend}: ${status}`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-1.5 rounded-full", i < filled ? fill : "bg-slate-200")} />
        ))}
      </div>
    </div>
  );
}

export function ReferralProgressLegend({ floorLabel }: { floorLabel: string }) {
  return (
    <div className="grid grid-cols-3 text-xs text-slate-500" aria-hidden="true">
      <span>Joined</span>
      <span className="text-center">Sent {floorLabel}+</span>
      <span className="text-right">Earned</span>
    </div>
  );
}
