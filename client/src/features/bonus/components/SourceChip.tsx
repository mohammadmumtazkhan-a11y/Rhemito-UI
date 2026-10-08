import { cn } from "@/lib/utils";
import { sourceGroupLabel } from "../lib/bonus";

const TONE: Record<string, string> = {
  REFERRAL: "bg-blue-50 text-blue-700 border-blue-100",
  SCHEME: "bg-purple-50 text-purple-700 border-purple-100",
  MANUAL: "bg-slate-100 text-slate-700 border-slate-200",
};

/** Small tag showing how a credit was earned (Referrals / Bonus offers / From Rhemito). Renders nothing for unknown sources. */
export function SourceChip({ source, className }: { source?: string | null; className?: string }) {
  const label = sourceGroupLabel(source);
  if (!label) return null;
  return (
    <span data-testid="source-chip" className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4", TONE[source as string], className)}>
      {label}
    </span>
  );
}
