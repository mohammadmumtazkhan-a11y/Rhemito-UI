import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resetDeviceId } from "@/lib/deviceId";
import { ExistingUserReferralCard } from "@/components/rewards/ExistingUserReferralCard";
import {
  APPLE_APP_STORE_URL,
  REFERRAL_CODE_RE,
  buildGooglePlayReferralUrl,
  clearReferral,
  detectClientDevice,
  loadReferral,
  saveReferral,
  visitorId,
  type RewardOffer,
  type StoredReferral,
} from "@/lib/rewards";

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
  INR: "₹",
  JPY: "¥",
  CNY: "¥",
  AUD: "A$",
  CAD: "C$",
  ZAR: "R",
  KES: "KSh",
  GHS: "GH₵",
  AED: "AED",
};

function formatCompactAmount(amount: number, currency: string): { symbol: string; numberText: string; fullText: string } {
  const n = Number(amount || 0);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const isWhole = Number.isInteger(n);
  const numberText = isWhole
    ? Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })
    : Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    symbol,
    numberText,
    fullText: `${symbol}${numberText}`,
  };
}

function resolvePlatform(search: string): "Android" | "iOS" | "Other" {
  const qs = new URLSearchParams(search || (typeof window !== "undefined" ? window.location.search : ""));
  const forced = (qs.get("platform") || "").toLowerCase();
  if (forced === "android") return "Android";
  if (forced === "ios") return "iOS";
  return detectClientDevice().operatingSystem;
}

/**
 * /ref/:code & /refer/:code — Mobile & Desktop Referral Entry:
 *   - Desktop / Laptop (operatingSystem === "Other"): Redirects straight to the email entry page (/sign-in-sign-up?mode=signup)
 *   - Android: Renders the Android referral landing page (Automatic Play Install Referrer + Get Rhemito on Google Play)
 *   - iOS: Renders the iOS referral landing page (Copy referral code + Download on the App Store)
 */
export default function ReferralLanding() {
  const [matchRef, paramsRef] = useRoute("/ref/:code");
  const [matchRefer, paramsRefer] = useRoute("/refer/:code");
  const rawCodeParam = (matchRef ? paramsRef?.code : matchRefer ? paramsRefer?.code : "") ?? "";
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const ran = useRef(false);
  const codeSpanRef = useRef<HTMLSpanElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [referralState, setReferralState] = useState<StoredReferral | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [deviceOs, setDeviceOs] = useState<"Android" | "iOS" | "Other">(() => resolvePlatform(search));
  const [existingUserMode, setExistingUserMode] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [existingContext, setExistingContext] = useState<{
    code: string;
    referrerFirstName?: string;
    offer?: RewardOffer | null;
    offers?: RewardOffer[];
  } | null>(null);
  const [checkEmailOpen, setCheckEmailOpen] = useState(false);
  const [mobileEmail, setMobileEmail] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [mobileEmailStatus, setMobileEmailStatus] = useState("");

  useEffect(() => {
    const resolvedOs = resolvePlatform(search);
    setDeviceOs(resolvedOs);
  }, [search]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = String(rawCodeParam).trim().toUpperCase();
    const qs = new URLSearchParams(search || (typeof window !== "undefined" ? window.location.search : ""));
    const ruleParam = qs.get("rule") ?? qs.get("rule_id");
    const ruleId = ruleParam && /^\d+$/.test(ruleParam) ? Number(ruleParam) : undefined;
    const forcedExisting = qs.get("existing") === "1" || qs.get("existing") === "true" || qs.get("user") === "existing";
    const resolvedOs = resolvePlatform(search);
    setDeviceOs(resolvedOs);
    const isDesktopOrOther = resolvedOs === "Other";

    const toSignUp = () => setLocation("/sign-in-sign-up?mode=signup", { replace: true });

    if (!REFERRAL_CODE_RE.test(code)) {
      clearReferral();
      toast({ title: "This referral link isn't valid", description: "You can still sign up." });
      toSignUp();
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/rewards/codes/${encodeURIComponent(code)}${ruleId ? `?rule_id=${ruleId}` : ""}`, { credentials: "include" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          clearReferral();
          const inactive = body?.error?.code === "REFERRER_INACTIVE";
          toast({ title: inactive ? "This referral link is no longer active" : "This referral link isn't valid", description: "You can still sign up." });
          toSignUp();
          return;
        }
        if (body.data?.signedIn || forcedExisting) {
          clearReferral();
          toast({ title: "Referral links are for new customers only" });
          setIsSignedIn(Boolean(body.data?.signedIn));
          setExistingContext({
            code: body.data?.code ?? code,
            referrerFirstName: body.data?.referrerFirstName,
            offer: body.data?.offer ?? null,
            offers: body.data?.offers,
          });
          setExistingUserMode(true);
          setLoading(false);
          return;
        }
        resetDeviceId();
        const effectiveRuleId = ruleId ?? (body.data?.ruleId ? Number(body.data.ruleId) : undefined);
        const initialStored: Omit<StoredReferral, "savedAt"> = {
          code: body.data?.code ?? code,
          ...(effectiveRuleId ? { ruleId: effectiveRuleId } : {}),
          referrerFirstName: body.data?.referrerFirstName,
          offer: body.data?.offer ?? null,
          offers: body.data?.offers,
          sendCurrencies: body.data?.sendCurrencies,
          playStoreUrl: buildGooglePlayReferralUrl(null, body.data?.code ?? code),
          appStoreUrl: APPLE_APP_STORE_URL,
          ...(isDesktopOrOther ? { channel: "WEB" as const, attributionMethod: "DIRECT_LINK", postSignupAppStoreUrl: null } : {}),
        };
        saveReferral(initialStored);
        setReferralState(loadReferral());
        setExistingContext({
          code: body.data?.code ?? code,
          referrerFirstName: body.data?.referrerFirstName,
          offer: body.data?.offer ?? null,
          offers: body.data?.offers,
        });

        // Record click & retrieve unpredictable trackingId (FR-02)
        let resolvedTrackingId: string | null = null;
        try {
          const visitRes = await fetch("/api/rewards/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              code: body.data?.code ?? code,
              visitorId: visitorId(),
              ...(effectiveRuleId ? { ruleId: effectiveRuleId } : {}),
            }),
          });
          const visitBody = await visitRes.json().catch(() => ({}));
          resolvedTrackingId = visitBody?.data?.trackingId ?? null;
          const playStoreUrl = visitBody?.data?.playStoreUrl ?? buildGooglePlayReferralUrl(resolvedTrackingId, code);
          const appStoreUrl = visitBody?.data?.appStoreUrl ?? APPLE_APP_STORE_URL;
          const updatedStored: Omit<StoredReferral, "savedAt"> = {
            ...initialStored,
            trackingId: resolvedTrackingId,
            playStoreUrl,
            appStoreUrl,
          };
          saveReferral(updatedStored);
          setReferralState(loadReferral());
        } catch {
          // Visit endpoint optional failure does not block landing page
        }

        if (isDesktopOrOther) {
          if (resolvedTrackingId) {
            void fetch(`/api/v1/referrals/clicks/${encodeURIComponent(resolvedTrackingId)}/handoff`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ storeTarget: "WEB", status: "CLICKED", operatingSystem: "Web" }),
            }).catch(() => {});
          }
          toSignUp();
          return;
        }

        setLoading(false);
      } catch {
        // Rewards offline: keep the code so the referral can still be recorded at sign-up
        if (forcedExisting) {
          clearReferral();
          setExistingContext({ code });
          setExistingUserMode(true);
          setLoading(false);
          return;
        }
        saveReferral({
          code,
          ...(ruleId ? { ruleId } : {}),
          playStoreUrl: buildGooglePlayReferralUrl(null, code),
          appStoreUrl: APPLE_APP_STORE_URL,
          ...(isDesktopOrOther ? { channel: "WEB" as const, attributionMethod: "MANUAL_CODE", postSignupAppStoreUrl: null } : {}),
        });
        setReferralState(loadReferral());
        setExistingContext({ code });
        if (isDesktopOrOther) {
          toSignUp();
          return;
        }
        setLoading(false);
      }
    })();
  }, [rawCodeParam, search, setLocation, toast]);

  const recordHandoff = async (storeTarget: "WEB" | "GOOGLE_PLAY" | "APPLE_APP_STORE", operatingSystem?: string) => {
    const trackingId = referralState?.trackingId;
    if (!trackingId) return;
    try {
      await fetch(`/api/v1/referrals/clicks/${encodeURIComponent(trackingId)}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          storeTarget,
          status: storeTarget === "WEB" ? "CLICKED" : "STORE_REDIRECT",
          operatingSystem,
        }),
      });
    } catch {
      // Non-blocking
    }
  };

  const handleCopyCode = async () => {
    if (!referralState?.code) return;
    try {
      await navigator.clipboard.writeText(referralState.code);
      setCopiedCode(true);
      setCopyStatus("Code copied. Paste it during registration.");
    } catch {
      setCopyStatus(`Touch and hold ${referralState.code} to copy it.`);
      if (codeSpanRef.current && typeof window !== "undefined") {
        const range = document.createRange();
        range.selectNodeContents(codeSpanRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  };

  const handleAndroidPlayStoreDownload = () => {
    if (!referralState) return;
    const playUrl = referralState.playStoreUrl || buildGooglePlayReferralUrl(referralState.trackingId, referralState.code);
    const updated = {
      ...referralState,
      channel: "ANDROID" as const,
      attributionMethod: "PLAY_INSTALL_REFERRER",
      playStoreUrl: playUrl,
    };
    saveReferral(updated);
    void recordHandoff("GOOGLE_PLAY", "Android");
    window.location.href = playUrl;
  };

  const handleIosAppStoreDownload = () => {
    if (!referralState) return;
    const appStoreUrl = referralState.appStoreUrl || APPLE_APP_STORE_URL;
    const updated = {
      ...referralState,
      channel: "IOS" as const,
      attributionMethod: "IOS_MANUAL_CODE",
    };
    saveReferral(updated);
    void recordHandoff("APPLE_APP_STORE", "iOS");
    window.location.href = appStoreUrl;
  };

  const handleMobileEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = mobileEmail.trim();
    if (!trimmed) return;
    setCheckingEmail(true);
    setMobileEmailStatus("");
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.registered) {
        clearReferral();
        toast({ title: "Referral links are for new customers only" });
        setExistingUserMode(true);
      } else if (res.ok) {
        setMobileEmailStatus("Lovely — you're new to Rhemito! You qualify for this welcome offer.");
      } else {
        setMobileEmailStatus(body?.message || "Please enter a valid email address.");
      }
    } catch {
      setMobileEmailStatus("Couldn't check your email right now. Please try again.");
    } finally {
      setCheckingEmail(false);
    }
  };

  if (loading || (!referralState && !existingUserMode)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f2f7] max-[460px]:bg-[#fcfcfe]" role="status" aria-live="polite">
        <div className="flex items-center gap-3 text-[15px] text-[#424a5b]">
          <Loader2 className="h-5 w-5 animate-spin text-[#6950cf]" />
          Opening your invitation…
        </div>
      </div>
    );
  }

  if (existingUserMode) {
    return (
      <div
        className="min-h-screen bg-[#f0f2f7] text-[#182235] font-sans antialiased flex flex-col items-center justify-center px-4 py-6"
        data-testid="referral-landing-page"
      >
        <ExistingUserReferralCard
          referrerFirstName={existingContext?.referrerFirstName ?? referralState?.referrerFirstName}
          clickedCode={existingContext?.code ?? referralState?.code}
          initialOffer={existingContext?.offer ?? referralState?.offer}
          initialOffers={existingContext?.offers ?? referralState?.offers}
          email={mobileEmail.trim() || undefined}
          signedIn={isSignedIn}
          platform={deviceOs}
          variant="standalone"
          onBackToNewUser={
            !isSignedIn && referralState
              ? () => {
                  saveReferral(referralState);
                  setExistingUserMode(false);
                }
              : undefined
          }
        />
      </div>
    );
  }

  if (!referralState) return null;

  const offer: RewardOffer | null = referralState.offer ?? null;
  const referrerName = referralState.referrerFirstName || "John";
  const referrerInitial = referrerName.trim().charAt(0).toUpperCase() || "R";
  const currencyCode = offer?.currency || "GBP";
  const rawRewardAmount =
    offer && offer.reward_type !== "REFERRER" && Number(offer.referee_reward) > 0
      ? Number(offer.referee_reward)
      : Number(offer?.referrer_reward || 20);
  const rawFloorAmount = Number(offer?.floor ?? 100);
  const windowDays = Number(offer?.qualification_window_days ?? 30);

  const rewardFormatted = formatCompactAmount(rawRewardAmount, currencyCode);
  const floorFormatted = formatCompactAmount(rawFloorAmount, currencyCode);

  const playUrl = referralState.playStoreUrl || buildGooglePlayReferralUrl(referralState.trackingId, referralState.code);
  const appStoreUrl = referralState.appStoreUrl || APPLE_APP_STORE_URL;
  const isIos = deviceOs === "iOS";

  return (
    <div
      className="min-h-screen bg-[#f0f2f7] max-[460px]:bg-[#fcfcfe] text-[#182235] font-sans antialiased flex flex-col items-center justify-center px-[16px] py-[20px] max-[460px]:p-0"
      data-testid="referral-landing-page"
    >
      <section
        aria-label={isIos ? "iOS referral page" : "Android referral page"}
        className="w-full max-w-[390px] max-[460px]:max-w-[430px] shrink-0"
      >
        <div
          className={`relative bg-[#fcfcfe] border border-[#e0e4ed] shadow-[0_18px_65px_rgba(38,51,83,0.035)] overflow-hidden px-[24px] pt-[23px] pb-[18px] max-[460px]:border-0 max-[460px]:shadow-none max-[460px]:rounded-none max-[460px]:pb-[19px] max-[360px]:px-[19px] ${
            isIos ? "rounded-[29px]" : "rounded-[26px]"
          }`}
        >
          {/* App Bar */}
          <header className="flex justify-between items-center mb-[24px] max-[460px]:mb-[22px]">
            <div className="flex items-center gap-[8px] text-[23px] font-bold tracking-[-1.1px] text-[#182235]">
              <svg viewBox="0 0 32 42" fill="none" aria-hidden="true" className="w-[24px] h-[30px] text-[#6a50d8]">
                <path
                  d="M3 38V3h25L17 19l11 19H18l-8-14-7 14Z"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
                <path d="m10 26 1-17h10L10 26Z" fill="currentColor" />
              </svg>
              <span>Rhemito</span>
            </div>
            <span className="text-[9px] tracking-[1.5px] text-[#a1a6b2] font-semibold">MONEY, CONNECTED.</span>
          </header>

          {/* Referrer Invite Strip */}
          <div className="text-[11px] text-[#7a8395] flex items-center gap-[7px] mb-[13px]">
            <span className="w-[24px] h-[24px] grid place-items-center rounded-full bg-[#ede8fc] text-[#6a4fc2] text-[10px] font-bold">
              {referrerInitial}
            </span>
            <span>
              <strong className="text-[#424a5b] font-semibold">{referrerName}</strong> invited you to Rhemito
            </span>
          </div>

          {/* Dark Hero Offer Card */}
          <section
            aria-label="Your referral offer"
            data-testid="referral-landing-marketing-hook"
            className={`bg-[#151e31] text-white px-[24px] pt-[23px] pb-[21px] max-[460px]:px-[23px] max-[460px]:pt-[21px] max-[460px]:pb-[20px] relative isolate overflow-hidden ${
              isIos ? "rounded-[19px]" : "rounded-[20px]"
            }`}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_100%_0,rgba(121,99,197,0.28),transparent_65%)]"
            />
            <div className="flex items-center gap-[6px] text-[9px] tracking-[1.6px] font-semibold text-[#c2b5ef]">
              <span className="text-[15px] leading-[12px] text-[#c8b8ff]">✦</span> A LITTLE WELCOME FROM US
            </div>
            <h1
              data-testid="referral-landing-heading"
              className="text-[22px] max-[360px]:text-[21px] leading-[1.28] font-medium tracking-[-0.7px] mt-[14px] max-[460px]:mt-[12px] mb-[8px] text-[#f1eff8]"
            >
              Good things start
              <br />
              with an invitation.
            </h1>
            <div className="text-[68px] max-[460px]:text-[66px] font-semibold leading-[1.05] tracking-[-4px] relative z-10">
              <sup className="text-[35px] align-top leading-[1.55] tracking-[-1.5px] mr-[3px]">{rewardFormatted.symbol}</sup>
              {rewardFormatted.numberText}
              <span className="text-[10px] tracking-[1px] font-normal text-[#b5b5ca] ml-[9px] inline-block align-middle">
                {currencyCode}
              </span>
            </div>
            <p className="text-[11px] text-[#abaec4] mt-[8px] mb-0 relative z-10">Bonus credit when you join &amp; send.</p>

            {/* Decorative Wireframe Orb */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute w-[139px] h-[139px] -right-[33px] top-[73px] rounded-full border border-[#a9a3d5]/17 -rotate-[28deg] shadow-[inset_0_0_25px_rgba(187,170,255,0.04)] bg-[linear-gradient(125deg,rgba(166,155,213,0.08),transparent)]"
            >
              <span className="absolute inset-0 rounded-full border border-[#bdb6e2]/17 scale-x-[0.44]" />
              <span className="absolute inset-0 rounded-full border border-[#bdb6e2]/17 scale-y-[0.42]" />
              <i className="absolute left-1/2 h-full border-l border-[#bdb6e2]/17">
                <span className="absolute top-1/2 w-[139px] -left-[69px] border-t border-[#bdb6e2]/17" />
              </i>
            </div>
          </section>

          {/* 3-Step Horizontal Timeline */}
          <ol
            aria-label="How to earn your bonus"
            className="grid grid-cols-3 list-none p-0 mt-[22px] mb-[23px] max-[460px]:my-[20px] gap-[9px]"
          >
            <li className="relative text-[9px] max-[360px]:text-[8px] text-[#9a9ead] leading-[1.5]">
              <span aria-hidden="true" className="absolute left-[29px] right-[2px] top-[11px] h-px bg-[#e4e5ed]" />
              <span
                className={`w-[23px] h-[23px] grid place-items-center bg-[#f0edf9] text-[#7b65bd] text-[10px] font-semibold mb-[8px] ${
                  isIos ? "rounded-full" : "rounded-[7px]"
                }`}
              >
                1
              </span>
              <strong className="block text-[11px] max-[360px]:text-[10px] font-semibold text-[#3f475a]">Join Rhemito</strong>
              Create your account
            </li>
            <li className="relative text-[9px] max-[360px]:text-[8px] text-[#9a9ead] leading-[1.5]">
              <span aria-hidden="true" className="absolute left-[29px] right-[2px] top-[11px] h-px bg-[#e4e5ed]" />
              <span
                className={`w-[23px] h-[23px] grid place-items-center bg-[#f0edf9] text-[#7b65bd] text-[10px] font-semibold mb-[8px] ${
                  isIos ? "rounded-full" : "rounded-[7px]"
                }`}
              >
                2
              </span>
              <strong className="block text-[11px] max-[360px]:text-[10px] font-semibold text-[#3f475a]">
                Send over {floorFormatted.fullText}
              </strong>
              Within {windowDays} days
            </li>
            <li className="relative text-[9px] max-[360px]:text-[8px] text-[#9a9ead] leading-[1.5]">
              <span
                className={`w-[23px] h-[23px] grid place-items-center bg-[#f0edf9] text-[#7b65bd] text-[10px] font-semibold mb-[8px] ${
                  isIos ? "rounded-full" : "rounded-[7px]"
                }`}
              >
                3
              </span>
              <strong className="block text-[11px] max-[360px]:text-[10px] font-semibold text-[#3f475a]">
                Get {rewardFormatted.fullText} credit
              </strong>
              Once you qualify
            </li>
          </ol>

          {/* Platform Action Card & Install Button */}
          <div data-testid="referral-download-app-section">
            {isIos ? (
              <div data-testid="ios-download-panel">
                <section
                  aria-label="Copy your referral code"
                  className="border border-[#e4e4ef] bg-[#f6f5fb] rounded-[14px] px-[15px] py-[12px] max-[360px]:p-[13px] mb-[17px] min-h-[84px]"
                >
                  <div className="flex justify-between items-center gap-[10px]">
                    <div>
                      <span className="text-[9px] text-[#9388ad] block mb-[5px]">FIRST, COPY YOUR REFERRAL CODE</span>
                      <span
                        ref={codeSpanRef}
                        data-testid="referral-landing-code"
                        className="text-[16px] max-[360px]:text-[14px] tracking-[1px] font-semibold text-[#4c3a78]"
                      >
                        {referralState.code}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      data-testid="referral-copy-code-btn"
                      aria-label={copiedCode ? "Referral code copied" : "Copy referral code"}
                      className="flex items-center justify-center gap-[6px] border border-[#dcd4ee] bg-white px-[11px] py-[9px] rounded-[8px] text-[#7054ae] text-[10px] font-semibold min-w-[74px]"
                    >
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="w-[12px] h-[12px]">
                        <rect x="7" y="7" width="10" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path
                          d="M12 7V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                      <span>{copiedCode ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="text-[9px] text-[#8b849d] leading-[1.55] m-0 mt-[9px]">
                    Paste it in the referral code field when you register in the app.
                  </p>
                  {copyStatus && (
                    <p className="text-[9px] leading-[1.4] text-[#7351b1] mt-[6px] mb-0" aria-live="polite">
                      {copyStatus}
                    </p>
                  )}
                </section>

                <a
                  href={appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    handleIosAppStoreDownload();
                  }}
                  data-testid="ios-option-b-appstore-btn"
                  className="flex w-full h-[52px] items-center justify-center gap-[10px] bg-[#182235] hover:bg-[#29364f] text-white border-0 rounded-[12px] no-underline text-[12px] font-semibold transition-colors"
                >
                  <svg viewBox="0 0 24 27" fill="currentColor" aria-hidden="true" className="w-[19px] h-[21px] shrink-0">
                    <path d="M16 0c.3 2-1.6 4.5-3.8 4.6C12 2.6 13.9.3 16 0ZM20.3 18.5c-.5 1.2-.8 1.8-1.5 2.9-1 1.5-2.4 3.4-4.1 3.4-1.5 0-1.8-1-3.8-1s-2.4 1-3.9 1c-1.6 0-3-1.7-4-3.2C.2 17.3-.7 11.3 1.2 8.3c1.4-2.2 3.6-3.5 5.8-3.5 1.7 0 2.8 1 4.2 1s2.3-1 4.3-1c1.8 0 3.6.9 4.8 2.4-4.2 2.3-3.5 8.4 0 11.3Z" />
                  </svg>
                  <span>Download on the App Store</span>
                </a>
                <p className="text-[9px] text-center text-[#a1a5b2] mt-[9px] mb-[17px] max-[460px]:mb-[14px]">
                  Copy your code before you leave this page.
                </p>
              </div>
            ) : (
              <div data-testid="android-download-panel">
                <section
                  aria-label="Automatic referral"
                  className="border border-[#e4e4ef] bg-[#f6f5fb] rounded-[14px] px-[16px] py-[15px] max-[360px]:p-[13px] mb-[17px] min-h-[84px]"
                >
                  <p className="flex items-center gap-[9px] text-[11px] font-semibold text-[#4c426d] mt-0 mb-[7px]">
                    <span className="w-[19px] h-[19px] rounded-full bg-[#e7e2f5] text-[#7155b8] grid place-items-center text-[10px] shrink-0">
                      ✓
                    </span>
                    Your invitation goes with you
                  </p>
                  <p className="text-[10px] text-[#8b849d] leading-[1.55] m-0 pl-[28px]">
                    Install and register. Your referral code
                    <br />
                    is passed automatically — no copying needed.
                  </p>
                </section>

                <a
                  href={playUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAndroidPlayStoreDownload();
                  }}
                  data-testid="download-android-playstore-btn"
                  className="flex w-full h-[52px] items-center justify-center gap-[10px] bg-[#6950cf] hover:bg-[#5940bd] text-white border-0 rounded-[15px] no-underline text-[12px] font-semibold shadow-[0_5px_12px_rgba(105,80,207,0.08)] transition-colors"
                >
                  <svg viewBox="0 0 24 26" fill="none" aria-hidden="true" className="w-[19px] h-[21px] shrink-0">
                    <path d="m3 2 18 11L3 24V2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="m3 2 12 15M3 24 15 9" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                  <span>Get Rhemito on Google Play</span>
                </a>
                <p className="text-[9px] text-center text-[#a1a5b2] mt-[9px] mb-[17px] max-[460px]:mb-[14px]">
                  Your next step: install the app and create an account.
                </p>
              </div>
            )}
          </div>

          {/* Already a Rhemito member? Switcher & Quick Email Check for Mobile */}
          <div className="mb-[14px] rounded-[12px] border border-[#e6e8f2] bg-[#f8f9fd] px-[12px] py-[10px] text-center">
            <p className="text-[10px] text-[#5c6479] m-0">
              Already joined Rhemito?{" "}
              <button
                type="button"
                data-testid="referral-already-member-btn"
                onClick={() => {
                  clearReferral();
                  toast({ title: "Referral links are for new customers only" });
                  setExistingUserMode(true);
                }}
                className="font-semibold text-[#6950cf] underline cursor-pointer bg-transparent border-0 p-0"
              >
                See offers for existing users
              </button>{" "}
              or{" "}
              <button
                type="button"
                data-testid="referral-check-email-toggle"
                onClick={() => setCheckEmailOpen((v) => !v)}
                className="font-semibold text-[#424a5b] underline cursor-pointer bg-transparent border-0 p-0"
              >
                check with your email
              </button>
            </p>
            {checkEmailOpen && (
              <form onSubmit={handleMobileEmailCheck} className="mt-[8px] flex flex-col gap-[6px]">
                <div className="flex items-center gap-[6px]">
                  <input
                    type="email"
                    value={mobileEmail}
                    onChange={(e) => {
                      setMobileEmail(e.target.value);
                      setMobileEmailStatus("");
                    }}
                    placeholder="Enter your email address"
                    data-testid="referral-mobile-email-input"
                    className="flex-1 h-[34px] rounded-[8px] border border-[#d6dae8] bg-white px-[10px] text-[11px] text-[#182235] focus:outline-none focus:border-[#6950cf]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={checkingEmail || !mobileEmail.trim()}
                    data-testid="referral-mobile-email-submit"
                    className="h-[34px] rounded-[8px] bg-[#182235] px-[12px] text-[10px] font-semibold text-white disabled:opacity-50"
                  >
                    {checkingEmail ? "Checking…" : "Check"}
                  </button>
                </div>
                {mobileEmailStatus && (
                  <p className="text-[10px] text-[#5940bd] m-0" data-testid="referral-mobile-email-status">
                    {mobileEmailStatus}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Expandable Referral Offer Details */}
          <details className="group border-t border-[#ececf2] pt-[13px] max-[460px]:pt-[11px] text-[9px] text-[#a1a6b5] text-center">
            <summary className="list-none cursor-pointer inline-flex gap-[7px] items-center text-[#9198aa] [&::-webkit-details-marker]:hidden">
              Referral offer details
              <span className="text-[12px] text-[#8b7bb0] group-open:hidden">⌄</span>
              <span className="hidden text-[12px] text-[#8b7bb0] group-open:inline">⌃</span>
            </summary>
            <p className="leading-[1.7] mt-[10px] mb-0 text-[#8890a2]">
              Join using {referrerName}’s referral code{" "}
              <span data-testid={isIos ? undefined : "referral-landing-code"}>{referralState.code}</span>. Complete a
              qualifying transfer over {floorFormatted.fullText}
              {offer?.receive_currency ? ` to ${offer.receive_currency}` : ""} within {windowDays} days to receive{" "}
              {rewardFormatted.fullText} in bonus credit. Bonuses are awarded according to the referral rules.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
