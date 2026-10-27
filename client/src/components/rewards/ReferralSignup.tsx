import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APPLE_APP_STORE_URL,
  REFERRAL_CODE_RE,
  buildGooglePlayReferralUrl,
  clearReferral,
  formatMoney,
  saveReferral,
  type StoredReferral,
} from "@/lib/rewards";

/** "Olayinka invited you – get £10.00 in 3 steps" strip above the sign-up form (spec §5). */
export function ReferralInviteStrip({ referral }: { referral: StoredReferral | null }) {
  const [copied, setCopied] = useState(false);
  const offer = referral?.offer;
  if (!referral || !offer || offer.reward_type === "REFERRER" || !(offer.referee_reward > 0)) return null;
  const reward = formatMoney(offer.referee_reward, offer.currency);
  const floor = formatMoney(offer.floor, offer.currency);
  const name = referral.referrerFirstName || "Your friend";
  const otherOffers = (referral.offers ?? []).filter(
    (o) => (o.rule_id !== offer.rule_id || o.currency !== offer.currency) && o.reward_type !== "REFERRER" && o.referee_reward > 0,
  );
  const playUrl = referral.playStoreUrl || buildGooglePlayReferralUrl(referral.trackingId, referral.code);
  const appStoreUrl = referral.appStoreUrl || APPLE_APP_STORE_URL;

  const notifyStoreHandoff = (storeTarget: "GOOGLE_PLAY" | "APPLE_APP_STORE", operatingSystem: string) => {
    if (!referral.trackingId) return;
    void fetch(`/api/v1/referrals/clicks/${encodeURIComponent(referral.trackingId)}/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ storeTarget, status: "STORE_REDIRECT", operatingSystem }),
    }).catch(() => {});
  };

  return (
    <section aria-label="Your welcome bonus" data-testid="referral-invite" className="mb-4 flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[15px] leading-[22px] text-slate-800">
        <strong className="text-slate-900">{name} invited you</strong> – get {reward} bonus credit in 3 steps.
      </p>
      <ol className="grid grid-cols-3 gap-1.5">
        <li className="flex flex-col gap-1.5"><span className="h-1.5 rounded-full bg-primary" /><span className="text-xs font-semibold text-blue-700">Join</span></li>
        <li className="flex flex-col gap-1.5"><span className="h-1.5 rounded-full bg-slate-200" /><span className="text-xs text-slate-600">Send {floor}+{offer.receive_currency ? ` to ${offer.receive_currency}` : ""} in {offer.qualification_window_days} days</span></li>
        <li className="flex flex-col gap-1.5"><span className="h-1.5 rounded-full bg-slate-200" /><span className="text-xs text-slate-600">Get {reward}</span></li>
      </ol>
      {otherOffers.length > 0 && (
        <div className="border-t border-slate-100 pt-2.5 space-y-1" data-testid="referral-invite-currencies">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Other send currencies</p>
          {otherOffers.map((o) => (
            <p key={`${o.rule_id}-${o.currency}`} className="text-xs text-slate-600">
              <strong className="text-slate-800">{o.currency}:</strong> Get <strong>{formatMoney(o.referee_reward, o.currency)}</strong> bonus credit when you send <strong>{formatMoney(o.floor, o.currency)}+</strong> in {o.qualification_window_days} days.
            </p>
          ))}
        </div>
      )}
      <div className="border-t border-slate-100 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs" data-testid="referral-invite-app-download">
        <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
          <Smartphone className="h-3.5 w-3.5 text-indigo-600" />
          Prefer the mobile app?
          {referral.postSignupAppStoreUrl && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              iOS App Store Redirect Active
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={playUrl}
            onClick={() => notifyStoreHandoff("GOOGLE_PLAY", "Android")}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="signup-strip-playstore-link"
            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <ExternalLink className="h-3 w-3" />
            Google Play
          </a>
          <a
            href={appStoreUrl}
            onClick={() => {
              try { void navigator.clipboard.writeText(referral.code); setCopied(true); } catch { /* ignore */ }
              notifyStoreHandoff("APPLE_APP_STORE", "iOS");
            }}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="signup-strip-appstore-link"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-200"
          >
            <Copy className="h-3 w-3" />
            {copied ? `Copied ${referral.code} · App Store` : "Copy Code & App Store"}
          </a>
        </div>
      </div>
    </section>
  );
}

interface ReferralCodeFieldProps {
  referral: StoredReferral | null;
  onChange: (referral: StoredReferral | null) => void;
}

/** Prefilled referral code chip, or an optional "Have a referral code?" field (US-3.2). */
export function ReferralCodeField({ referral, onChange }: ReferralCodeFieldProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  if (referral) {
    const offer = referral.offer;
    const hasHook = offer && offer.reward_type !== "REFERRER" && Number(offer.referee_reward) > 0;
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" data-testid="referral-code-applied">
        <Check className="h-[18px] w-[18px] text-teal-700" strokeWidth={2.5} />
        <span className="flex-1 text-sm text-slate-800">
          Referral code <strong>{referral.code}</strong>
          {referral.referrerFirstName && <span className="block text-xs text-teal-700">Code applied – invited by {referral.referrerFirstName}</span>}
          {hasHook && offer && (
            <span className="mt-0.5 block text-xs font-semibold text-indigo-700" data-testid="referral-code-hook">
              You get {formatMoney(offer.referee_reward, offer.currency)} on your first {offer.currency} transfer above {formatMoney(offer.floor, offer.currency)}
              {offer.reward_type === "BOTH" && offer.referrer_reward > 0 ? ` (${referral.referrerFirstName || "your friend"} gets ${formatMoney(offer.referrer_reward, offer.currency)})` : ""}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => { clearReferral(); onChange(null); setValue(""); }}
          className="h-9 px-2 text-sm font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          Remove
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
        Have a referral code?
      </button>
    );
  }

  const validate = async () => {
    const code = value.trim().toUpperCase();
    setValue(code);
    setError("");
    if (!code) return;
    if (!REFERRAL_CODE_RE.test(code)) {
      setError("Referral codes are 6–12 letters and numbers.");
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`/api/rewards/codes/${encodeURIComponent(code)}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 503 ? "We couldn't check this code right now. You can still sign up and we'll check it later." : "We couldn't find this referral code. Check it or leave the field blank.");
        if (res.status === 503) {
          const ref = { code, savedAt: Date.now() };
          saveReferral(ref);
          onChange(ref);
        }
        return;
      }
      const ref: StoredReferral = {
        code: body.data?.code ?? code,
        ...(body.data?.ruleId ? { ruleId: Number(body.data.ruleId) } : {}),
        referrerFirstName: body.data?.referrerFirstName,
        offer: body.data?.offer ?? null,
        offers: body.data?.offers,
        sendCurrencies: body.data?.sendCurrencies,
        savedAt: Date.now(),
      };
      saveReferral(ref);
      onChange(ref);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <label htmlFor="referral-code" className="mb-1 block text-sm text-slate-500">Referral code (optional)</label>
      <div className="relative">
        <input
          id="referral-code"
          value={value}
          maxLength={16}
          autoComplete="off"
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onBlur={validate}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "referral-code-error" : undefined}
          placeholder="e.g. OLAYINKA2025"
          className={cn("block w-full rounded border px-3 py-2.5 text-base uppercase text-slate-700 focus:border-blue-500 focus:ring-blue-500 sm:text-sm", error ? "border-red-400" : "border-slate-200")}
        />
        {checking && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" />}
      </div>
      {error && <p id="referral-code-error" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
