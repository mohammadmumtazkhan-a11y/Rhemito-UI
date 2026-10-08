import { Info } from "lucide-react";
import { BONUS_COPY } from "../lib/copy";
import { SUPPORT_LINK_ENABLED, supportHref } from "@/lib/support";

/** Shown when the customer is blocked from earning bonus. The reason stays with admins (7.2). */
export function BonusBlockedNotice({ className = "", onContact }: { className?: string; onContact?: () => void }) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[14px] leading-[21px] text-amber-900 ${className}`}
      data-testid="bonus-blocked-notice"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        {BONUS_COPY.blocked}
        {" "}
        {onContact ? (
          <button type="button" onClick={onContact} className="font-semibold underline underline-offset-2 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
            {BONUS_COPY.contactSupport}
          </button>
        ) : SUPPORT_LINK_ENABLED ? (
          <a href={supportHref("Bonus credit")} data-testid="bonus-contact-support" className="font-semibold underline underline-offset-2 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
            {BONUS_COPY.contactSupport}
          </a>
        ) : (
          <span aria-disabled="true" title="Coming soon" data-testid="bonus-contact-support" className="font-semibold underline underline-offset-2 opacity-50 cursor-not-allowed">
            {BONUS_COPY.contactSupport}
          </span>
        )}
      </p>
    </div>
  );
}
