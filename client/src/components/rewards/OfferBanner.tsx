import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { RewardsSummary } from "@/lib/rewards";

const dismissedKey = (id: number) => `rhemito.offerDismissed.${id}`;

function isDismissed(id: number): boolean {
  try { return localStorage.getItem(dismissedKey(id)) === "1"; } catch { return false; }
}

interface OfferBannerProps {
  latestOffer: RewardsSummary["latestOffer"];
  onView: () => void;
}

/** Dismissible "New offer" banner on the dashboard (AC-6.1.5, spec §1). */
export function OfferBanner({ latestOffer, onView }: OfferBannerProps) {
  const reduce = useReducedMotion();
  const [dismissedId, setDismissedId] = useState<number | null>(null);
  const visible = Boolean(latestOffer) && dismissedId !== latestOffer!.id && !isDismissed(latestOffer!.id);

  const dismiss = () => {
    if (latestOffer) {
      try { localStorage.setItem(dismissedKey(latestOffer.id), "1"); } catch { /* ignore */ }
    }
    if (latestOffer) setDismissedId(latestOffer.id);
  };

  return (
    <AnimatePresence>
      {visible && latestOffer && (
        <motion.div
          role="status"
          data-testid="offer-banner"
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 py-3.5 pl-4 pr-2"
        >
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[13px] font-bold tracking-wide text-blue-700">
              {latestOffer.kind === "IMPROVED" ? "BETTER OFFER" : "NEW OFFER"}
            </span>
            <span className="text-[15px] leading-[22px] text-slate-900">{latestOffer.message}</span>
            <button
              type="button"
              onClick={onView}
              className="self-start text-[15px] font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              View offer
            </button>
          </div>
          <button
            type="button"
            aria-label="Dismiss offer"
            onClick={dismiss}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
