import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { REFERRAL_CODE_RE, clearReferral, formatMoney, saveReferral, type StoredReferral } from "@/lib/rewards";

/** "Olayinka invited you – get £10.00 in 3 steps" strip above the sign-up form (spec §5). */
export function ReferralInviteStrip({ referral }: { referral: StoredReferral | null }) {
  const offer = referral?.offer;
  if (!referral || !offer || offer.reward_type === "REFERRER" || !(offer.referee_reward > 0)) return null;
  const reward = formatMoney(offer.referee_reward, offer.currency);
  const floor = formatMoney(offer.floor, offer.currency);
  const name = referral.referrerFirstName || "Your friend";
  return (
    <section aria-label="Your welcome bonus" data-testid="referral-invite" className="mb-4 flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[15px] leading-[22px] text-slate-800">
        <strong className="text-slate-900">{name} invited you</strong> – get {reward} bonus credit in 3 steps.
      </p>
      <ol className="grid grid-cols-3 gap-1.5">
        <li className="flex flex-col gap-1.5"><span className="h-1.5 rounded-full bg-primary" /><span className="text-xs font-semibold text-blue-700">Join</span></li>
        <li className="flex flex-col gap-1.5"><span className="h-1.5 rounded-full bg-slate-200" /><span className="text-xs text-slate-600">Send {floor}+ in {offer.qualification_window_days} days</span></li>
        <li className="flex flex-col gap-1.5"><span className="h-1.5 rounded-full bg-slate-200" /><span className="text-xs text-slate-600">Get {reward}</span></li>
      </ol>
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
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" data-testid="referral-code-applied">
        <Check className="h-[18px] w-[18px] text-teal-700" strokeWidth={2.5} />
        <span className="flex-1 text-sm text-slate-800">
          Referral code <strong>{referral.code}</strong>
          {referral.referrerFirstName && <span className="block text-xs text-teal-700">Code applied – invited by {referral.referrerFirstName}</span>}
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
      const ref: StoredReferral = { code, referrerFirstName: body.data?.referrerFirstName, offer: body.data?.offer ?? null, savedAt: Date.now() };
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
          maxLength={12}
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
