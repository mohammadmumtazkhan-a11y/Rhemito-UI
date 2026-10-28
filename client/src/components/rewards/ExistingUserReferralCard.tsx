import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Check,
  Copy,
  Gift,
  LogIn,
  Send,
  Share2,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  APPLE_APP_STORE_URL,
  GOOGLE_PLAY_BASE_URL,
  buildReferralShareMessage,
  buildReferralShareTitle,
  clearReferral,
  formatMoney,
  formatUkDate,
  type RewardOffer,
} from "@/lib/rewards";
import { RhemitoLogoIcon } from "@/components/rewards/RhemitoLogoIcon";
import type { BonusOffer } from "@/features/bonus/lib/bonus";

interface ExistingUserOffersPayload {
  signedIn: boolean;
  currency: string;
  viewerFirstName: string | null;
  viewerReferralCode: string | null;
  viewerReferralLink: string | null;
  referralOffer: RewardOffer | null;
  referralOffers: RewardOffer[];
  bonusOffers: BonusOffer[];
}

export interface ExistingUserReferralCardProps {
  referrerFirstName?: string | null;
  clickedCode?: string | null;
  initialOffer?: RewardOffer | null;
  initialOffers?: RewardOffer[];
  email?: string | null;
  signedIn?: boolean;
  platform?: "Android" | "iOS" | "Other";
  variant?: "standalone" | "embedded";
  onSignInClick?: () => void;
  onBackToNewUser?: () => void;
}

export function ExistingUserReferralCard({
  referrerFirstName,
  clickedCode,
  initialOffer,
  initialOffers,
  email,
  signedIn: initialSignedIn = false,
  platform = "Other",
  variant = "standalone",
  onSignInClick,
  onBackToNewUser,
}: ExistingUserReferralCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copiedOwnLink, setCopiedOwnLink] = useState(false);
  const [data, setData] = useState<ExistingUserOffersPayload | null>(null);

  useEffect(() => {
    // Existing users cannot use a new-customer referral code; ensure it is cleared
    clearReferral();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const currency = initialOffer?.currency ?? "GBP";
    const qs = new URLSearchParams({ currency });
    if (email) qs.set("email", email);

    fetch(`/api/rewards/existing-user-offers?${qs.toString()}`, {
      credentials: "include",
    })
      .then((res) => res.json().catch(() => ({})))
      .then((body) => {
        if (!cancelled && body?.data) {
          setData(body.data as ExistingUserOffersPayload);
        }
      })
      .catch(() => {
        // Non-blocking: falls back to initialOffer + standard scheme explanations
      });

    return () => {
      cancelled = true;
    };
  }, [initialOffer?.currency, email]);

  const isSignedIn = data?.signedIn ?? initialSignedIn;
  const viewerName = data?.viewerFirstName || null;
  const inviterName = referrerFirstName?.trim() || "your friend";
  const activeOffer = data?.referralOffer ?? initialOffer ?? null;
  const currency = activeOffer?.currency ?? data?.currency ?? "GBP";

  const referrerReward = Number(activeOffer?.referrer_reward ?? 5);
  const refereeReward = Number(activeOffer?.referee_reward ?? 10);
  const floorAmount = Number(activeOffer?.floor ?? 50);
  const windowDays = Number(activeOffer?.qualification_window_days ?? 30);
  const validityDays = Number(activeOffer?.bonus_validity_days ?? 90);

  const referrerRewardText = formatMoney(referrerReward, currency);
  const refereeRewardText = formatMoney(refereeReward, currency);
  const floorText = formatMoney(floorAmount, currency);
  const corridorText = activeOffer?.receive_currency ? ` to ${activeOffer.receive_currency}` : "";

  const allCurrencyOffers =
    (data?.referralOffers && data.referralOffers.length > 0
      ? data.referralOffers
      : initialOffers && initialOffers.length > 0
        ? initialOffers
        : activeOffer
          ? [activeOffer]
          : []
    ).filter((o) => o.reward_type !== "REFEREE" && Number(o.referrer_reward) > 0);

  const liveBonusOffers = data?.bonusOffers ?? [];
  const ownLink = data?.viewerReferralLink ?? null;
  const ownCode = data?.viewerReferralCode ?? null;

  const isIos = platform === "iOS";
  const isAndroid = platform === "Android";
  const isMobilePlatform = isIos || isAndroid;

  const handleCopyOwnLink = async () => {
    if (!ownLink) return;
    try {
      await navigator.clipboard.writeText(ownLink);
      setCopiedOwnLink(true);
      setTimeout(() => setCopiedOwnLink(false), 2500);
      toast({
        title: "Your referral link is copied!",
        description: "Share it with friends and earn bonus credit when they send.",
      });
    } catch {
      toast({
        title: "Couldn't copy automatically",
        description: ownLink,
      });
    }
  };

  const handleShareOwnInvite = async () => {
    if (!ownLink) return;
    const shareTitle = buildReferralShareTitle({
      offer: activeOffer,
      code: ownCode,
      link: ownLink,
      referrerFirstName: viewerName,
    });
    const shareHook = buildReferralShareMessage({
      offer: activeOffer,
      code: ownCode,
      link: ownLink,
      referrerFirstName: viewerName,
      includeUrl: false,
    });
    const fullMessage = buildReferralShareMessage({
      offer: activeOffer,
      code: ownCode,
      link: ownLink,
      referrerFirstName: viewerName,
      includeUrl: true,
    });
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle, text: shareHook, url: ownLink });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(fullMessage);
      toast({
        title: "Invite message & link copied!",
        description: "Paste it into WhatsApp, SMS, or email to invite your friends.",
      });
    } catch {
      toast({ title: "Couldn't copy invite message", description: ownLink });
    }
  };

  return (
    <div
      data-testid="existing-user-referral-view"
      data-platform={platform.toLowerCase()}
      className={cn(
        "w-full text-[#182235] font-sans antialiased",
        variant === "standalone"
          ? isMobilePlatform
            ? "max-w-[410px] mx-auto"
            : "max-w-[760px] mx-auto"
          : "mb-5",
      )}
    >
      <div
        className={cn(
          "bg-[#fcfcfe] border border-[#e0e4ed] shadow-[0_18px_65px_rgba(38,51,83,0.05)] overflow-hidden",
          isIos ? "rounded-[28px]" : "rounded-[24px]",
          variant === "standalone" ? "p-5 sm:p-7" : "p-4 sm:p-5",
        )}
      >
        {/* Top App Bar (Standalone mode) */}
        {variant === "standalone" && (
          <header className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2 text-[22px] font-bold tracking-[-0.9px] text-[#182235]">
              <RhemitoLogoIcon />
              <span>Rhemito</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2ff] px-3 py-1 text-[10px] font-semibold tracking-wider uppercase text-[#4f46e5]">
              {isIos ? "iOS Member View" : isAndroid ? "Android Member View" : "Existing Member View"}
            </span>
          </header>
        )}

        {/* Dark Navy Hero — Warm British Explanation */}
        <section
          aria-label="New customer offer notice"
          data-testid="existing-user-british-notice"
          className="bg-[#151e31] text-white rounded-[20px] p-5 sm:p-6 relative isolate overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_100%_0,rgba(121,99,197,0.32),transparent_65%)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[1.5px] font-semibold uppercase text-[#c8b8ff]">
              <span className="text-[14px] leading-none">✦</span> ALREADY PART OF THE RHEMITO FAMILY
            </span>
            {clickedCode && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-slate-300">
                Link code: {clickedCode} (New starters only)
              </span>
            )}
          </div>

          <h1
            data-testid="existing-user-heading"
            className="font-display text-[22px] sm:text-[26px] font-semibold leading-[1.25] tracking-[-0.5px] mt-3 text-white"
          >
            Lovely to see you again{viewerName ? `, ${viewerName}` : ""}!
          </h1>

          <p
            data-testid="existing-user-explanation"
            className="mt-2.5 text-[13px] sm:text-[14px] leading-[1.6] text-[#cbd0e3]"
          >
            Chuffed you popped by! Just a quick heads-up —{" "}
            <strong className="text-white font-semibold">{inviterName}&apos;s referral link</strong> is a welcome offer{" "}
            <strong className="text-white font-semibold">exclusively for new users</strong> joining Rhemito for the very
            first time, rather than existing users.
          </p>
          <p className="mt-2 text-[13px] sm:text-[14px] leading-[1.6] text-[#cbd0e3]">
            Because you&apos;ve already joined us, this welcome link won&apos;t apply to your account —{" "}
            <strong className="text-[#a5f3fc] font-semibold">
              but you certainly don&apos;t miss out on the perks!
            </strong>{" "}
            Here are the offers available for existing members right now and how you can benefit from each.
          </p>
        </section>

        {/* Section Header: Existing Customer Offers */}
        <div className="mt-6 mb-3.5 flex items-center justify-between gap-2">
          <div>
            <h2
              data-testid="existing-user-offers-heading"
              className="font-display text-[16px] sm:text-[18px] font-bold text-[#182235]"
            >
              Offers for existing users &amp; how you benefit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Three ways to earn bonus credit and cut your transfer costs as a Rhemito member.
            </p>
          </div>
        </div>

        {/* Offer Cards List */}
        <div className="space-y-3.5" data-testid="existing-user-offers-list">
          {/* OFFER 1: Refer & Earn (Be the Inviter) */}
          <article
            data-testid="existing-offer-refer-earn"
            className="rounded-2xl border border-blue-100 bg-gradient-to-br from-[#f5f8ff] to-white p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                  <Users className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    1. Refer &amp; Earn · Turn the Tables
                  </span>
                  <h3 className="font-display text-[15px] sm:text-[16px] font-bold text-slate-900">
                    Invite your own friends &amp; earn {referrerRewardText} each time
                  </h3>
                </div>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                Earn {referrerRewardText} / friend
              </span>
            </div>

            <p className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-slate-700">
              While you can&apos;t claim a new-starter link, you can share{" "}
              <strong className="text-slate-900">your own personal referral link</strong> with friends and family. When a
              friend joins with your link and sends <strong className="text-slate-900">{floorText} or more</strong>
              {corridorText} within <strong className="text-slate-900">{windowDays} days</strong>, you earn{" "}
              <strong className="text-slate-900">{referrerRewardText}</strong> in bonus credit
              {refereeReward > 0 ? ` (and your friend gets ${refereeRewardText} too!)` : ""}.
            </p>

            {allCurrencyOffers.length > 1 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5" data-testid="existing-offer-multi-currency">
                {allCurrencyOffers.map((o) => (
                  <span
                    key={`${o.rule_id}-${o.currency}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-blue-200 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                  >
                    <strong className="text-blue-700">{o.currency}:</strong> Earn{" "}
                    {formatMoney(o.referrer_reward, o.currency)} when friend sends {formatMoney(o.floor, o.currency)}+
                  </span>
                ))}
              </div>
            )}

            {/* How you benefit box */}
            <div className="mt-3 rounded-xl bg-white/90 border border-blue-100/90 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 mb-1.5">
                How you benefit from Refer &amp; Earn
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span>
                    <strong className="text-slate-900">Pay less on your transfer:</strong> Choose{" "}
                    <em>&ldquo;Pay less&rdquo;</em> on Step 1 of Send Money to deduct your earned bonus credit straight
                    off the total you pay.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span>
                    <strong className="text-slate-900">Or send more to your recipient:</strong> Choose{" "}
                    <em>&ldquo;Send more&rdquo;</em> to add your bonus credit on top of your transfer so your loved ones
                    receive extra money at no extra cost to you (valid for {validityDays} days).
                  </span>
                </li>
              </ul>
            </div>

            {/* Signed-in user's own referral link */}
            {isSignedIn && ownLink && (
              <div
                className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-blue-200 bg-white p-2 pl-3"
                data-testid="existing-user-own-referral-box"
              >
                <div className="flex-1 min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Your personal referral link {ownCode ? `(${ownCode})` : ""}
                  </span>
                  <span className="block text-xs font-semibold text-slate-800 truncate">
                    {ownLink.replace(/^https?:\/\//, "")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    onClick={handleCopyOwnLink}
                    data-testid="existing-user-copy-own-link-btn"
                    className={cn(
                      "h-9 rounded-lg px-3.5 text-xs font-semibold text-white shrink-0",
                      copiedOwnLink ? "bg-teal-700 hover:bg-teal-800" : "bg-blue-600 hover:bg-blue-700",
                    )}
                  >
                    {copiedOwnLink ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    {copiedOwnLink ? "Copied your link" : "Copy my link"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleShareOwnInvite}
                    data-testid="existing-user-share-own-invite-btn"
                    className="h-9 rounded-lg border-blue-200 px-3 text-xs font-semibold text-slate-900 shrink-0"
                  >
                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                    Share invite
                  </Button>
                </div>
              </div>
            )}
          </article>

          {/* OFFER 2: Active Bonus Schemes (Loyalty, Threshold & Request Money) */}
          <article
            data-testid="existing-offer-bonus-schemes"
            className="rounded-2xl border border-purple-100 bg-gradient-to-br from-[#faf7ff] to-white p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                    2. Member Bonus Schemes · Automatic Rewards
                  </span>
                  <h3 className="font-display text-[15px] sm:text-[16px] font-bold text-slate-900">
                    Loyalty, Transfer Threshold &amp; Request Money Bonuses
                  </h3>
                </div>
              </div>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                Auto-credited
              </span>
            </div>

            {liveBonusOffers.length > 0 ? (
              <div className="mt-3 space-y-2" data-testid="existing-live-bonus-schemes">
                <p className="text-xs font-semibold text-slate-700">
                  Live bonus schemes currently active for {currency}:
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {liveBonusOffers.map((scheme) => (
                    <li
                      key={scheme.id}
                      data-testid="existing-live-scheme-item"
                      className="rounded-xl border border-purple-200/80 bg-white p-3 flex flex-col gap-1"
                    >
                      <span className="text-xs font-bold text-slate-900">{scheme.name}</span>
                      <span className="text-xs text-slate-600 leading-relaxed">{scheme.summary}</span>
                      {(scheme.end_date_display || scheme.end_date) && (
                        <span className="text-[11px] font-medium text-purple-700">
                          Ends {scheme.end_date_display || formatUkDate(scheme.end_date)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-slate-700">
                Existing Rhemito customers automatically qualify for our ongoing member bonus schemes across your send
                currencies:
              </p>
            )}

            <div className="mt-3 rounded-xl bg-white/90 border border-purple-100/90 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 mb-1.5">
                How you benefit from each Bonus Scheme
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <Gift className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Loyalty Bonus Credit:</strong> Complete the target number of
                    transfers within the scheme window (e.g. multiple transfers in 30 days) and bonus credit is added
                    straight to your wallet.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Gift className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Transfer Threshold Bonus:</strong> Send at or above the scheme
                    threshold in a single transfer to unlock fixed or percentage bonus credit automatically.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Gift className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Request Money Bonus:</strong> When someone pays your Rhemito
                    money request of the qualifying amount or more, you earn bonus credit in your{" "}
                    <strong>Reward$</strong> wallet to spend on future transfers.
                  </span>
                </li>
              </ul>
            </div>
          </article>

          {/* OFFER 3: Promo Codes */}
          <article
            data-testid="existing-offer-promo-codes"
            className="rounded-2xl border border-teal-100 bg-gradient-to-br from-[#f2fbf9] to-white p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
                  <Tag className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                    3. Promo Codes · Instant Discounts
                  </span>
                  <h3 className="font-display text-[15px] sm:text-[16px] font-bold text-slate-900">
                    Fee waivers, percentage discounts &amp; request bonuses
                  </h3>
                </div>
              </div>
              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
                Instant savings
              </span>
            </div>

            <p className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-slate-700">
              Existing members can apply active Rhemito promo codes on both{" "}
              <strong className="text-slate-900">Send Money</strong> and{" "}
              <strong className="text-slate-900">Request Money</strong> transactions.
            </p>

            <div className="mt-3 rounded-xl bg-white/90 border border-teal-100/90 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-800 mb-1.5">
                How you benefit from Promo Codes
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span>
                    <strong className="text-slate-900">Cut or waive your transfer fee:</strong> On Step 1 of{" "}
                    <strong>Send Money</strong>, tap <em>&ldquo;Use Promo Code&rdquo;</em> and enter your code to get
                    100% fee waivers, percentage fee discounts, or fixed amount discounts immediately.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span>
                    <strong className="text-slate-900">Boost your Request Money payout:</strong> Enter a qualifying
                    bonus code when creating a payment request to earn extra bonus paid into your bank alongside your
                    settlement.
                  </span>
                </li>
              </ul>
            </div>
          </article>
        </div>

        {/* Platform-Specific CTAs (Web Desktop/Laptop, Android, iOS) */}
        <div className="mt-6 pt-4 border-t border-slate-200/80 flex flex-col gap-3" data-testid="existing-user-actions">
          {isSignedIn ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <Button
                type="button"
                onClick={() => setLocation("/bonus-discounts")}
                data-testid="existing-user-go-rewards-btn"
                className="h-11 flex-1 rounded-xl bg-[#182235] hover:bg-[#29364f] text-white text-xs sm:text-sm font-semibold"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Explore My Reward$ &amp; Offers
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                type="button"
                onClick={() => setLocation("/send-money")}
                data-testid="existing-user-send-money-btn"
                className="h-11 flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold"
              >
                <Send className="mr-2 h-4 w-4" />
                Send Money &amp; Use Perks
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="existing-user-dashboard-btn"
                className="h-11 rounded-xl border-slate-300 text-xs sm:text-sm font-semibold text-slate-700"
              >
                Dashboard
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <Button
                  type="button"
                  onClick={() => {
                    if (onSignInClick) {
                      onSignInClick();
                    } else {
                      setLocation("/sign-in-sign-up");
                    }
                  }}
                  data-testid="existing-user-signin-btn"
                  className="h-11 flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {variant === "embedded"
                    ? "Continue to sign in below to access your offers"
                    : "Sign in to your Rhemito account"}
                </Button>

                {isAndroid && (
                  <a
                    href={GOOGLE_PLAY_BASE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="existing-user-android-app-btn"
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#182235] hover:bg-[#29364f] px-4 text-white text-xs font-semibold no-underline transition-colors"
                  >
                    <span>Open Rhemito on Android</span>
                  </a>
                )}

                {isIos && (
                  <a
                    href={APPLE_APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="existing-user-ios-app-btn"
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#182235] hover:bg-[#29364f] px-4 text-white text-xs font-semibold no-underline transition-colors"
                  >
                    <span>Open Rhemito on iOS</span>
                  </a>
                )}
              </div>

              {onBackToNewUser && (
                <button
                  type="button"
                  onClick={onBackToNewUser}
                  data-testid="existing-user-back-to-new-btn"
                  className="self-center text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                >
                  Actually new to Rhemito? View the new-starter welcome offer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
