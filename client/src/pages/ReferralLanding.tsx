import { useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { REFERRAL_CODE_RE, clearReferral, saveReferral, visitorId } from "@/lib/rewards";

/**
 * /ref/:code — validates the referral link, counts the visit, remembers the
 * code for 30 days and opens sign-up (US-3.1).
 */
export default function ReferralLanding() {
  const [, params] = useRoute("/ref/:code");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = String(params?.code ?? "").trim().toUpperCase();

    const toSignUp = () => setLocation("/sign-in-sign-up?mode=signup", { replace: true });

    if (!REFERRAL_CODE_RE.test(code)) {
      clearReferral();
      toast({ title: "This referral link isn't valid", description: "You can still sign up." });
      toSignUp();
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/rewards/codes/${encodeURIComponent(code)}`, { credentials: "include" });
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
        saveReferral({ code, referrerFirstName: body.data?.referrerFirstName, offer: body.data?.offer ?? null });
        void fetch("/api/rewards/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, visitorId: visitorId() }),
        }).catch(() => {});
        toSignUp();
      } catch {
        // Rewards offline: keep the code so the referral can still be recorded at sign-up
        saveReferral({ code });
        toSignUp();
      }
    })();
  }, [params?.code, setLocation, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-[15px] text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Opening your invitation…
      </div>
    </div>
  );
}
