import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Check, Copy, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatMoney, type RewardOffer, type MyReferral } from "@/lib/rewards";
import { ReferralProgressLegend, ReferralProgressRow } from "./ReferralProgress";

interface ReferEarnCardProps {
  offer: RewardOffer | null;
  referrals: MyReferral[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  highlighted?: boolean;
}

/** Renders the offer sentence with the money amounts in bold. */
function OfferSentence({ text }: { text: string }) {
  const parts = text.split(/((?:£|\$|€|₦|₹|¥|A\$|C\$|R|KSh |GH₵|AED )\d[\d,]*(?:\.\d{2})?)/g);
  return (
    <p className="text-[15px] leading-[23px] text-slate-700" data-testid="refer-offer-text">
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="text-slate-900">{p}</strong> : <span key={i}>{p}</span>))}
    </p>
  );
}

/** Dashboard Refer & Earn card — approved "Mix" design (spec §2). */
export function ReferEarnCard({ offer, referrals, isLoading, isError, onRetry, highlighted }: ReferEarnCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => () => clearTimeout(timer.current), []);

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3" data-testid="refer-earn-loading">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="refer-earn-error">
        <h2 className="font-display text-lg font-bold text-slate-900">Refer &amp; Earn</h2>
        <p className="mt-2 text-sm text-slate-600">
          We couldn&apos;t load your referral details.{" "}
          <button type="button" onClick={onRetry} className="font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
            Retry
          </button>
        </p>
      </Card>
    );
  }

  // No active rule for the customer's currency → no card (AC-2.1.5)
  if (!offer) return null;

  const link = offer.referral_link ?? "";
  const latest = referrals.slice(0, 3);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
      toast({ title: "Referral link copied!", description: "Share it with friends to earn bonus credit." });
    } catch {
      inputRef.current?.select();
      toast({ title: "We couldn't copy the link", description: "Please copy it manually.", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title: "Join me on Rhemito", text: "Join me on Rhemito and get bonus credit on your first transfer:", url: link });
    } catch {
      // Share sheet closed by the customer — nothing to do
    }
  };

  return (
    <Card
      id="refer-earn"
      data-testid="refer-earn-card"
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-4 transition-shadow duration-300",
        highlighted && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-slate-900">Refer &amp; Earn</h2>
        <button
          type="button"
          onClick={() => setHowOpen(true)}
          className="min-h-[44px] px-1 text-sm font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          How it works
        </button>
      </div>

      {offer.cap_reached ? (
        <p className="text-[15px] leading-[23px] text-slate-700" data-testid="refer-cap-reached">
          You&apos;ve reached the maximum referral rewards for this programme. Thank you for spreading the word!
        </p>
      ) : (
        <>
          <OfferSentence text={offer.text} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="referral-link" className="text-[13px] font-semibold text-slate-600">Your referral link</label>
            <input
              id="referral-link"
              ref={inputRef}
              readOnly
              value={link.replace(/^https?:\/\//, "")}
              onFocus={(e) => e.currentTarget.select()}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-display text-[15px] font-semibold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div className={cn("grid gap-2.5", canShare ? "grid-cols-2" : "grid-cols-1")}>
            <Button
              type="button"
              onClick={handleCopy}
              className={cn("h-12 rounded-xl text-[15px] font-semibold text-white", copied ? "bg-teal-700 hover:bg-teal-800" : "bg-blue-600 hover:bg-blue-700")}
            >
              {copied ? <Check className="mr-2 h-[18px] w-[18px]" /> : <Copy className="mr-2 h-[18px] w-[18px]" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            {canShare && (
              <Button type="button" variant="outline" onClick={handleShare} className="h-12 rounded-xl border-slate-300 text-[15px] font-semibold text-slate-900">
                <Share2 className="mr-2 h-[18px] w-[18px]" />
                Share
              </Button>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col gap-3.5 border-t border-slate-200 pt-3.5" data-testid="refer-latest">
        {latest.length === 0 ? (
          <p className="text-sm text-slate-600">No referrals yet. Share your link to start earning.</p>
        ) : (
          <>
            {latest.map((r) => <ReferralProgressRow key={r.id} referral={r} />)}
            <ReferralProgressLegend floorLabel={formatMoney(offer.floor, offer.currency)} />
            <Link href="/bonus-discounts?tab=referrals" className="text-[15px] font-semibold text-blue-600 hover:underline">
              See all referrals ({referrals.length})
            </Link>
          </>
        )}
      </div>

      <Dialog open={howOpen} onOpenChange={setHowOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">How Refer &amp; Earn works</DialogTitle>
            <DialogDescription>{offer.text}</DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3 text-[15px] text-slate-700">
            <li><strong className="text-slate-900">1.</strong> Share your link. Your friend signs up with it and verifies their email.</li>
            <li><strong className="text-slate-900">2.</strong> They send {formatMoney(offer.floor, offer.currency)} or more within {offer.qualification_window_days} days of joining.</li>
            <li><strong className="text-slate-900">3.</strong> When that transfer completes, the bonus credit is added. Use it within {offer.bonus_validity_days} days.</li>
          </ol>
          <p className="text-xs text-slate-500">Each friend can be rewarded once. Self-referrals and duplicate accounts are not rewarded.</p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
