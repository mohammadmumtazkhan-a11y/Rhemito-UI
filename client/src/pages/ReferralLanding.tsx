import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { Check, Copy, ExternalLink, Globe, Loader2, Smartphone, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resetDeviceId } from "@/lib/deviceId";
import {
  APPLE_APP_STORE_URL,
  REFERRAL_CODE_RE,
  buildGooglePlayReferralUrl,
  clearReferral,
  detectClientDevice,
  formatMoney,
  loadReferral,
  saveReferral,
  visitorId,
  type RewardOffer,
  type StoredReferral,
} from "@/lib/rewards";

/**
 * /ref/:code & /refer/:code — FR-02, FR-03, FR-04, FR-06:
 * Validates the referral link, records the click with a unique unpredictable trackingId,
 * saves the referral context for 30 days, and routes by detected client device:
 *   - Desktop / Laptop (operatingSystem === "Other"): Redirects straight to the email entry page (/sign-in-sign-up?mode=signup)
 *   - Android: Shows Continue on Website + Android (Google Play Store) download option only
 *   - iOS: Shows Continue on Website + iOS (Apple App Store) options only
 */
export default function ReferralLanding() {
  const [matchRef, paramsRef] = useRoute("/ref/:code");
  const [matchRefer, paramsRefer] = useRoute("/refer/:code");
  const rawCodeParam = (matchRef ? paramsRef?.code : matchRefer ? paramsRefer?.code : "") ?? "";
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const ran = useRef(false);

  const [loading, setLoading] = useState(true);
  const [referralState, setReferralState] = useState<StoredReferral | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [deviceOs, setDeviceOs] = useState<"Android" | "iOS" | "Other">(() => detectClientDevice().operatingSystem);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = String(rawCodeParam).trim().toUpperCase();
    const qs = new URLSearchParams(search || (typeof window !== "undefined" ? window.location.search : ""));
    const ruleParam = qs.get("rule") ?? qs.get("rule_id");
    const ruleId = ruleParam && /^\d+$/.test(ruleParam) ? Number(ruleParam) : undefined;
    const detected = detectClientDevice();
    setDeviceOs(detected.operatingSystem);
    const isDesktopOrOther = detected.operatingSystem === "Other";

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
        if (body.data?.signedIn) {
          toast({ title: "Referral links are for new customers only" });
          setLocation("/", { replace: true });
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
        saveReferral({
          code,
          ...(ruleId ? { ruleId } : {}),
          playStoreUrl: buildGooglePlayReferralUrl(null, code),
          appStoreUrl: APPLE_APP_STORE_URL,
          ...(isDesktopOrOther ? { channel: "WEB" as const, attributionMethod: "MANUAL_CODE", postSignupAppStoreUrl: null } : {}),
        });
        setReferralState(loadReferral());
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
      toast({
        title: "Referral code copied!",
        description: `${referralState.code} is copied to your clipboard.`,
      });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      toast({ title: `Your referral code: ${referralState.code}` });
    }
  };

  const handleContinueOnWeb = () => {
    if (referralState) {
      const updated = {
        ...referralState,
        channel: "WEB" as const,
        attributionMethod: referralState.trackingId ? "DIRECT_LINK" : "MANUAL_CODE",
        postSignupAppStoreUrl: null,
      };
      saveReferral(updated);
    }
    void recordHandoff("WEB", "Web");
    setLocation("/sign-in-sign-up?mode=signup");
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

  const handleIosRegisterBeforeDownload = () => {
    if (!referralState) return;
    const appStoreUrl = referralState.appStoreUrl || APPLE_APP_STORE_URL;
    const updated = {
      ...referralState,
      channel: "IOS" as const,
      attributionMethod: "IOS_PRE_REGISTER",
      postSignupAppStoreUrl: appStoreUrl,
    };
    saveReferral(updated);
    void recordHandoff("APPLE_APP_STORE", "iOS");
    setLocation("/sign-in-sign-up?mode=signup&channel=IOS");
  };

  const handleIosCopyAndDownload = async () => {
    if (!referralState) return;
    try {
      await navigator.clipboard.writeText(referralState.code);
      setCopiedCode(true);
    } catch {
      // ignore clipboard error
    }
    const appStoreUrl = referralState.appStoreUrl || APPLE_APP_STORE_URL;
    const updated = {
      ...referralState,
      channel: "IOS" as const,
      attributionMethod: "IOS_MANUAL_CODE",
    };
    saveReferral(updated);
    void recordHandoff("APPLE_APP_STORE", "iOS");
    toast({
      title: `Referral code ${referralState.code} copied!`,
      description: "Opening Apple App Store — paste this code when registering in the Rhemito iOS app.",
    });
    window.location.href = appStoreUrl;
  };

  if (loading || !referralState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status" aria-live="polite">
        <div className="flex items-center gap-3 text-[15px] text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Opening your invitation…
        </div>
      </div>
    );
  }

  const offer: RewardOffer | null = referralState.offer ?? null;
  const referrerName = referralState.referrerFirstName || "Your friend";
  const hasRefereeReward = offer && offer.reward_type !== "REFERRER" && Number(offer.referee_reward) > 0;
  const rewardText = hasRefereeReward && offer ? formatMoney(offer.referee_reward, offer.currency) : null;
  const floorText = offer ? formatMoney(offer.floor, offer.currency) : null;
  const playUrl = referralState.playStoreUrl || buildGooglePlayReferralUrl(referralState.trackingId, referralState.code);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/40 px-4 py-8 sm:py-12" data-testid="referral-landing-page">
      <div className="mx-auto max-w-2xl">
        {/* Top Logo Header */}
        <div className="mb-6 flex items-center">
          <div className="flex items-center space-x-2">
            <svg
              width="26"
              height="33"
              viewBox="0 0 26 33"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8"
            >
              <path
                d="M25.0764 30.3999C25.0471 30.0963 24.9593 29.8023 24.813 29.5351L16.8761 14.4493L24.8398 3.57589C25.5715 2.5726 25.352 1.17091 24.3471 0.439699C23.9495 0.165191 23.5007 0 22.9983 0H2.25129C1.63908 0 1.08296 0.238069 0.658557 0.655904C0.251228 1.06159 0 1.62275 0 2.24222V30.604C0 31.3109 0.348792 32.0008 0.924419 32.4162C1.83664 33.0988 3.22693 32.9434 3.95622 32.0688C3.99769 32.0227 4.03183 31.9741 4.07086 31.9279L10.3296 23.3818L21.3836 32.3312C21.5568 32.4769 21.7543 32.5911 21.9641 32.6786C23.5007 33.332 25.2447 32.0591 25.0739 30.4023L25.0764 30.3999ZM9.49542 16.915L4.5099 23.7218V4.4893H18.6006L11.5857 14.0606L15.7541 21.9825L9.49542 16.915Z"
                fill="#3D48D1"
              />
            </svg>
            <span className="text-2xl font-semibold text-slate-800 tracking-tight">Rhemito</span>
          </div>
        </div>

        {/* Main Invitation Card (FR-03) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-6 text-white sm:px-8">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              <Sparkles className="h-3.5 w-3.5" />
              Official Referral Invitation
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="referral-landing-heading">
              Welcome to Rhemito!
            </h1>
            <p className="mt-1.5 text-sm text-blue-100 sm:text-base">
              You&apos;ve been invited to join Rhemito by <strong className="font-semibold text-white">{referrerName}</strong>.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Marketing Hook Highlight Banner */}
            {offer && (
              <div
                className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-indigo-50/50 p-4 sm:p-5 shadow-2xs"
                data-testid="referral-landing-marketing-hook"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                    {offer.currency} Referral Offer
                  </span>
                  <span className="text-xs font-medium text-slate-600">
                    Valid for {offer.qualification_window_days} days from registration
                  </span>
                </div>
                {rewardText && floorText ? (
                  <p className="text-base sm:text-lg font-bold text-slate-900">
                    Get <span className="text-emerald-700">{rewardText}</span> on your first {offer.currency} transfer above{" "}
                    <span className="text-indigo-700">{floorText}</span>
                    {offer.receive_currency ? ` to ${offer.receive_currency}` : ""}!
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-slate-900">{offer.text}</p>
                )}
                {offer.reward_type !== "REFEREE" && Number(offer.referrer_reward) > 0 && floorText && (
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    Plus, <strong>{referrerName}</strong> earns{" "}
                    <strong className="text-slate-900">{formatMoney(offer.referrer_reward, offer.currency)}</strong> once your first transfer of {floorText}+ completes.
                  </p>
                )}
              </div>
            )}

            {/* Referral Code Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Your referral code</p>
                <p className="mt-0.5 font-mono text-2xl font-bold tracking-wider text-slate-900" data-testid="referral-landing-code">
                  {referralState.code}
                </p>
                {rewardText && floorText && offer ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Get <strong className="text-slate-900">{rewardText}</strong> bonus credit when you send{" "}
                    <strong className="text-slate-900">{floorText}+</strong>
                    {offer.receive_currency ? ` to ${offer.receive_currency}` : ""} within {offer.qualification_window_days} days.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">
                    Your referral code is active and ready to be linked to your new Rhemito account.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                data-testid="referral-copy-code-btn"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 transition-colors"
              >
                {copiedCode ? <Check className="h-4 w-4 text-teal-600" /> : <Copy className="h-4 w-4" />}
                {copiedCode ? "Code Copied" : "Copy Referral Code"}
              </button>
            </div>

            {/* Choice 1 & Choice 2 (FR-03: Download Mobile App first, Continue on Website second) */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Choose how you want to join Rhemito
              </h2>

              {/* Option 1: Download Mobile App (Strictly device-specific: Android only sees Google Play; iOS only sees App Store) */}
              {deviceOs === "Android" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4" data-testid="referral-download-app-section">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Download the Android App</h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Install the official Rhemito mobile app on Google Play.
                      </p>
                    </div>
                  </div>

                  {/* Android Google Play Attribution Box (FR-04 & FR-05) */}
                  <div className="rounded-xl border border-emerald-200 bg-white p-4 space-y-3" data-testid="android-download-panel">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Downloading from Google Play automatically carries your referral code (<strong className="font-mono font-semibold text-slate-800">{referralState.code}</strong>) into the Rhemito Android app when you open it.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                      <a
                        href={playUrl}
                        onClick={(e) => {
                          e.preventDefault();
                          handleAndroidPlayStoreDownload();
                        }}
                        data-testid="download-android-playstore-btn"
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Download on Google Play Store
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Code ({referralState.code})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {deviceOs === "iOS" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4" data-testid="referral-download-app-section">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Download the iPhone App</h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Install the official Rhemito mobile app from the Apple App Store.
                      </p>
                    </div>
                  </div>

                  {/* iOS Apple App Store Handoff Box (FR-06 Option A & Option B) */}
                  <div className="space-y-3" data-testid="ios-download-panel">
                    {/* Option A — Register Before Installation (Recommended) */}
                    <div className="rounded-xl border border-indigo-200 bg-white p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-indigo-950">Option A — Register Before Installation</span>
                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Create your Rhemito account here first so your referral bonus is permanently locked to your profile, then we&apos;ll take you straight to the official Apple App Store to install the app and sign in.
                      </p>
                      <button
                        type="button"
                        onClick={handleIosRegisterBeforeDownload}
                        data-testid="ios-option-a-register-btn"
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                      >
                        Register First, Then Open Apple App Store
                      </button>
                    </div>

                    {/* Option B — Download Without Registration */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">Option B — Download Directly from App Store</span>
                        <span className="font-mono text-[11px] text-slate-500">Manual Code Entry</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Copy your referral code <strong className="font-mono text-slate-900">{referralState.code}</strong> and proceed directly to the Apple App Store. Enter the code when registering inside the Rhemito iOS app.
                      </p>
                      <a
                        href={referralState.appStoreUrl || APPLE_APP_STORE_URL}
                        onClick={(e) => {
                          e.preventDefault();
                          void handleIosCopyAndDownload();
                        }}
                        data-testid="ios-option-b-appstore-btn"
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Code ({referralState.code}) &amp; Open Apple App Store
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Option 2: Continue on Website (FR-08) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 hover:border-indigo-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Continue on Website</h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Create your account in your browser now. Your referral code <strong>{referralState.code}</strong> is automatically applied.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleContinueOnWeb}
                    data-testid="referral-continue-web-btn"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                  >
                    Continue on Website
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
