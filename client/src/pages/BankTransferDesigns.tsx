import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Check,
  Copy,
  Clock,
  Mail,
  ShieldCheck,
  Info,
  Monitor,
  Smartphone,
  LayoutGrid,
  Lock,
  Landmark,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConceptFilter = "all" | 1 | 2 | 3;
type ViewMode = "both" | "web" | "mobile";

export default function BankTransferDesigns() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [conceptFilter, setConceptFilter] = useState<ConceptFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [prefixEnabled, setPrefixEnabled] = useState<boolean>(true);
  const [secondsLeft, setSecondsLeft] = useState<number>(29 * 60 + 22);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const payeeName = prefixEnabled
    ? "Rhemito Firopo Akin-Agunbiade"
    : "Firopo Akin-Agunbiade";

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleCopy = (value: string, label: string, keyId: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(value);
    }
    setCopiedKey(keyId);
    toast({
      title: `Copied ${label}`,
      description: value,
    });
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleCopyAll = (keyId: string) => {
    const allDetails = [
      `Amount to Pay: GBP 5.00`,
      `Transaction Reference: #24590955`,
      `Account / Payee Name: ${payeeName}`,
      `Bank Account Number: 20739483`,
      `Sort Code: 041404`,
      `Payment Reference: 20092400804`,
    ].join("\n");

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(allDetails);
    }
    setCopiedKey(keyId);
    toast({
      title: "Copied all bank transfer details",
      description: "Ready to paste in your banking app.",
    });
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const showWeb = viewMode === "both" || viewMode === "web";
  const showMobile = viewMode === "both" || viewMode === "mobile";

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-slate-900 pb-24 antialiased">
      {/* Sticky Stakeholder Review Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-display font-extrabold text-base shadow-inner ring-1 ring-white/20">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm text-white">
                  Rhemito Bank Transfer UX Showcase
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-medium">
                  Stakeholder Review
                </span>
              </div>
              <p className="text-xs text-slate-400">
                3 World-Class Fintech Concepts • Purpose-built Desktop &amp; Native Mobile layouts
              </p>
            </div>
          </div>

          {/* Concept Switcher */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            {[
              { id: "all" as const, label: "All 3 Concepts" },
              { id: 1 as const, label: "1. Cobalt Spotlight" },
              { id: 2 as const, label: "2. Emerald Vault" },
              { id: 3 as const, label: "3. Indigo Split-Ticket" },
            ].map((tab) => (
              <button
                key={String(tab.id)}
                type="button"
                onClick={() => setConceptFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  conceptFilter === tab.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Prefix & Viewport Controls */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPrefixEnabled((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                prefixEnabled
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  prefixEnabled ? "bg-emerald-400" : "bg-slate-400"
                }`}
              />
              <span>Prefix: &quot;Rhemito&quot; {prefixEnabled ? "ON" : "OFF"}</span>
            </button>

            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode("both")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "both"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Web + Mobile</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("web")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "web"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Web Only</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("mobile")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "mobile"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile Only</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8 space-y-16">
        {/* ================================================================= */}
        {/* CONCEPT 1: COBALT & TEAL PAYEE SPOTLIGHT                          */}
        {/* ================================================================= */}
        {(conceptFilter === "all" || conceptFilter === 1) && (
          <section className="space-y-5" data-testid="concept-1-section">
            <div className="bg-white rounded-2xl border border-slate-200/90 px-6 py-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-bold uppercase tracking-wider">
                    Concept 01 • Recommended
                  </span>
                  <h2 className="font-display text-lg font-extrabold text-slate-900">
                    Cobalt Payee Spotlight &amp; Clean Action Stack
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Elevates the <strong>Exact Amount (GBP 5.00)</strong> and frames the{" "}
                  <strong>Account / Payee Name</strong> inside a high-contrast Cobalt Spotlight box so
                  users never confuse it with Currency Cloud or their personal savings.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                Palette: Cobalt Blue • Teal • Alabaster
              </span>
            </div>

            <div className="flex flex-col xl:flex-row items-start justify-center gap-8">
              {/* 1A. DESKTOP WEB VIEW */}
              {showWeb && (
                <div className="w-full flex-1 max-w-2xl mx-auto">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                    <Monitor className="w-4 h-4 text-blue-600" />
                    Desktop Web View (Single Viewport — Zero Scroll)
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
                    <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setLocation("/send-money")}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Payment Methods
                      </button>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                          ✓ Order #24590955 Created
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span className="font-mono tabular-nums">{formatTimer(secondsLeft)}</span> left
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-5">
                      {/* Hero Amount Banner */}
                      <div className="p-5 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-4 shadow-sm">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                            Pay with Bank Transfer
                          </span>
                          <div className="flex items-baseline gap-3 mt-1">
                            <span className="font-display text-4xl font-extrabold tracking-tight tabular-nums text-white">
                              GBP 5.00
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy("5.00", "Amount GBP 5.00", "c1-web-amt")}
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-blue-200 transition-colors cursor-pointer"
                            >
                              {copiedKey === "c1-web-amt" ? "✓ Copied" : "Copy Amount"}
                            </button>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Kindly make a payment of <strong className="text-white">GBP 5.00</strong> to
                            the bank account details below • Recipient gets{" "}
                            <strong className="text-emerald-400">9,055.05 NGN</strong>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyAll("c1-web-all")}
                          className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
                        >
                          {copiedKey === "c1-web-all" ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Copied All</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copy All</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* #1 PAYEE SPOTLIGHT BOX */}
                      <div className="rounded-2xl p-5 border-2 border-blue-600 bg-gradient-to-br from-blue-50 via-white to-teal-50/40 shadow-md">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-blue-700">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                              1
                            </span>
                            Use this Account Name for your payment to us
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                            Account / Payee Name
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 py-1">
                          <p className="font-display text-2xl font-extrabold text-slate-950 tracking-tight">
                            {payeeName}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopy(payeeName, "Account Name", "c1-web-name")}
                            className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            {copiedKey === "c1-web-name" ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Name</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="mt-2.5 pt-2.5 border-t border-blue-200/70 flex items-center gap-2 text-xs font-semibold text-blue-900">
                          <Info className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>
                            (Ensure you enter this name as is in your bank account — dedicated Rhemito
                            payment account)
                          </span>
                        </div>
                      </div>

                      {/* #2, #3, #4: 3-COLUMN HORIZONTAL DATA GRID */}
                      <div className="grid grid-cols-3 gap-3.5">
                        {[
                          { num: "2", label: "Account Number", value: "20739483", key: "c1-w-acc" },
                          { num: "3", label: "Sort Code", value: "04-14-04", raw: "041404", key: "c1-w-sort" },
                          { num: "4", label: "Reference", value: "20092400804", key: "c1-w-ref" },
                        ].map((item) => (
                          <div
                            key={item.key}
                            className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-300 transition-all flex flex-col justify-between gap-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-500">
                                {item.num}. {item.label}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(item.raw ?? item.value, item.label, item.key)
                                }
                                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 text-slate-600 hover:text-blue-600 cursor-pointer"
                                title={`Copy ${item.label}`}
                              >
                                {copiedKey === item.key ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <p className="font-mono text-xl font-extrabold text-slate-900 tracking-wide tabular-nums">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Footer Attribution & Email Strip */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          (Payment account solution provided by Currency Cloud)
                        </span>
                        <span className="text-blue-600 font-semibold flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          Details sent to your registered email
                        </span>
                      </div>

                      {/* Bottom Actions */}
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setLocation("/")}
                          className="flex-1 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-all cursor-pointer"
                        >
                          I&apos;ve noted the details — take me to Dashboard
                        </button>
                        <button
                          type="button"
                          className="py-3 px-4 rounded-xl border border-slate-200 hover:bg-red-50 hover:border-red-200 text-xs font-bold text-red-600 transition-colors cursor-pointer"
                        >
                          Cancel Transaction
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 1B. NATIVE MOBILE VIEW (375PX IOS FRAME) */}
              {showMobile && (
                <div className="mx-auto shrink-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    Mobile App View (iPhone 375px)
                  </div>

                  <div className="w-[375px] bg-[#F8FAFC] border-[11px] border-slate-900 rounded-[48px] shadow-2xl overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="px-6 pt-2.5 pb-1.5 flex items-center justify-between text-xs font-bold text-slate-900 bg-white">
                        <span>9:41</span>
                        <div className="w-24 h-5 bg-slate-900 rounded-full" />
                        <span>5G 100%</span>
                      </div>

                      <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="text-center">
                          <p className="text-xs font-bold text-slate-900">Pay with Bank Transfer</p>
                          <p className="text-xs text-emerald-600 font-semibold">Ref #24590955 Created</p>
                        </div>
                        <div className="px-2 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold font-mono tabular-nums">
                          {formatTimer(secondsLeft)}
                        </div>
                      </div>

                      <div className="p-4 space-y-3.5">
                        {/* Mobile Hero Amount Card */}
                        <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
                          <div>
                            <p className="text-xs text-blue-300 font-semibold">Amount to transfer</p>
                            <p className="font-display text-3xl font-extrabold text-white tabular-nums mt-0.5">
                              GBP 5.00
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">They get 9,055.05 NGN</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyAll("c1-mob-all")}
                            className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{copiedKey === "c1-mob-all" ? "Copied" : "Copy All"}</span>
                          </button>
                        </div>

                        {/* Mobile #1 Spotlight Payee Card */}
                        <div className="rounded-2xl p-3.5 border-2 border-blue-600 bg-gradient-to-br from-blue-50 via-white to-teal-50/40 space-y-2 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-blue-700 uppercase">
                              Use this Account Name
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(payeeName, "Account Name", "c1-mob-name")}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer"
                            >
                              {copiedKey === "c1-mob-name" ? "✓ Copied" : "Copy Name"}
                            </button>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-medium">Account / Payee Name</p>
                            <p className="font-display text-base font-extrabold text-slate-950 leading-snug mt-0.5">
                              {payeeName}
                            </p>
                          </div>
                          <p className="text-xs text-blue-800 font-medium pt-1.5 border-t border-blue-200/60 leading-snug">
                            (Ensure you enter this name as is in your bank account)
                          </p>
                        </div>

                        {/* Mobile #2, #3, #4 Clean Vertical Stack */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                          {[
                            { label: "Bank Account Number", value: "20739483", key: "c1-m-acc" },
                            { label: "Sort Code", value: "04-14-04", raw: "041404", key: "c1-m-sort" },
                            { label: "Payment Reference", value: "20092400804", key: "c1-m-ref" },
                          ].map((row) => (
                            <div
                              key={row.key}
                              className="px-3.5 py-3 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs text-slate-500 font-medium">{row.label}</p>
                                <p className="font-mono text-base font-extrabold text-slate-900 mt-0.5 tabular-nums">
                                  {row.value}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(row.raw ?? row.value, row.label, row.key)
                                }
                                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                              >
                                {copiedKey === row.key ? "✓ Copied" : "Copy"}
                              </button>
                            </div>
                          ))}
                        </div>

                        <p className="text-center text-xs text-slate-500 font-medium pt-0.5">
                          (Payment account solution provided by Currency Cloud)
                        </p>
                      </div>
                    </div>

                    <div className="bg-white border-t border-slate-200 px-4 pt-3 pb-2">
                      <button
                        type="button"
                        onClick={() => setLocation("/")}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-sm cursor-pointer"
                      >
                        I&apos;ve noted the details — Dashboard
                      </button>
                      <button
                        type="button"
                        className="w-full py-2 text-xs font-semibold text-red-600 cursor-pointer"
                      >
                        Cancel Transaction
                      </button>
                      <div className="w-28 h-1 bg-slate-300 rounded-full mx-auto mt-1" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* CONCEPT 2: MIDNIGHT SLATE & EMERALD VAULT                         */}
        {/* ================================================================= */}
        {(conceptFilter === "all" || conceptFilter === 2) && (
          <section
            className="space-y-5 pt-8 border-t-2 border-slate-200"
            data-testid="concept-2-section"
          >
            <div className="bg-white rounded-2xl border border-slate-200/90 px-6 py-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider">
                    Concept 02 • Neo-Bank Vault
                  </span>
                  <h2 className="font-display text-lg font-extrabold text-slate-900">
                    Midnight Slate &amp; Emerald Payee Vault
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Uses a high-contrast <strong>Midnight &amp; Emerald Vault header</strong> housing the
                  Hero Amount and the Payee Name, paired with a crisp white bottom sheet for the
                  numeric fields.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-emerald-400 text-xs font-semibold">
                Palette: Midnight Slate • Emerald • Pure White
              </span>
            </div>

            <div className="flex flex-col xl:flex-row items-start justify-center gap-8">
              {/* 2A. DESKTOP WEB VIEW */}
              {showWeb && (
                <div className="w-full flex-1 max-w-2xl mx-auto">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                    <Monitor className="w-4 h-4 text-emerald-600" />
                    Desktop Web View
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white space-y-5">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setLocation("/send-money")}
                          className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-300">
                            Order <strong className="text-white">#24590955</strong>
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 text-xs font-bold font-mono tabular-nums">
                            ⏱ {formatTimer(secondsLeft)}
                          </span>
                        </div>
                      </div>

                      <div className="text-center py-1">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                          Transfer Exact Amount
                        </span>
                        <div className="font-display text-5xl font-extrabold text-white tracking-tight tabular-nums mt-1">
                          GBP 5.00
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          Recipient receives <strong className="text-emerald-300">9,055.05 NGN</strong>
                        </p>
                      </div>

                      <div className="rounded-2xl p-4 bg-emerald-500/10 border-2 border-emerald-500 shadow-lg">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                            Use this Account Name for your payment to us
                          </span>
                          <span className="text-xs font-semibold text-slate-950 bg-emerald-400 px-2 py-0.5 rounded-md">
                            Payee Name
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 py-1">
                          <p className="font-display text-2xl font-extrabold text-white tracking-tight">
                            {payeeName}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopy(payeeName, "Account Name", "c2-web-name")}
                            className="shrink-0 px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-extrabold transition-colors cursor-pointer"
                          >
                            {copiedKey === "c2-web-name" ? "✓ Copied" : "Copy Name"}
                          </button>
                        </div>

                        <p className="text-xs text-emerald-200/90 font-medium mt-2 pt-2 border-t border-emerald-500/30">
                          (Ensure you enter this name as is in your bank account — this is your
                          dedicated Rhemito payment account)
                        </p>
                      </div>
                    </div>

                    <div className="p-6 bg-white space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider">
                          Bank Account &amp; Reference Details
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleCopyAll("c2-web-all")}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedKey === "c2-web-all" ? "✓ Copied All" : "Copy All Details"}</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {[
                          { label: "Bank Account Number", value: "20739483", key: "c2-w-acc" },
                          { label: "Sort Code", value: "041404 (04-14-04)", raw: "041404", key: "c2-w-sort" },
                          { label: "Payment Reference", value: "20092400804", key: "c2-w-ref" },
                        ].map((item) => (
                          <div
                            key={item.key}
                            className="px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-between"
                          >
                            <div>
                              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                              <p className="font-mono text-lg font-extrabold text-slate-900 mt-0.5 tabular-nums">
                                {item.value}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(item.raw ?? item.value, item.label, item.key)
                              }
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 text-xs font-bold text-slate-700 cursor-pointer"
                            >
                              {copiedKey === item.key ? "✓ Copied" : "Copy"}
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium">
                          (Payment account solution provided by Currency Cloud)
                        </span>
                        <span className="text-emerald-700 font-semibold">
                          ✉️ Emailed to your registered address
                        </span>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setLocation("/")}
                          className="flex-1 py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-all cursor-pointer"
                        >
                          I&apos;ve noted the details — take me to Dashboard
                        </button>
                        <button
                          type="button"
                          className="py-3 px-4 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2B. NATIVE MOBILE VIEW */}
              {showMobile && (
                <div className="mx-auto shrink-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    Mobile App View (iPhone 375px)
                  </div>

                  <div className="w-[375px] bg-[#0B1120] border-[11px] border-slate-900 rounded-[48px] shadow-2xl overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="px-6 pt-2.5 pb-1.5 flex items-center justify-between text-xs font-bold text-white">
                        <span>9:41</span>
                        <div className="w-24 h-5 bg-black rounded-full" />
                        <span>5G 100%</span>
                      </div>

                      <div className="px-4 pt-2 pb-5 text-white space-y-3.5">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-bold text-slate-300">Ref #24590955</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold font-mono tabular-nums">
                            {formatTimer(secondsLeft)}
                          </span>
                        </div>

                        <div className="text-center py-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            Amount to Pay
                          </p>
                          <p className="font-display text-4xl font-extrabold text-white tabular-nums mt-0.5">
                            GBP 5.00
                          </p>
                        </div>

                        <div className="rounded-2xl p-3.5 bg-emerald-500/10 border border-emerald-500 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-emerald-300 uppercase">
                              Use this Account Name
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(payeeName, "Account Name", "c2-mob-name")}
                              className="px-2.5 py-1 rounded-lg bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                            >
                              {copiedKey === "c2-mob-name" ? "✓ Copied" : "Copy"}
                            </button>
                          </div>
                          <p className="font-display text-base font-extrabold text-white leading-snug">
                            {payeeName}
                          </p>
                          <p className="text-xs text-emerald-200/90 leading-snug pt-1 border-t border-emerald-500/30">
                            (Ensure you enter this name as is in your bank account)
                          </p>
                        </div>
                      </div>

                      <div className="bg-white rounded-t-3xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                            Transfer Details
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyAll("c2-mob-all")}
                            className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg cursor-pointer"
                          >
                            {copiedKey === "c2-mob-all" ? "✓ Copied All" : "Copy All Details"}
                          </button>
                        </div>

                        <div className="space-y-2">
                          {[
                            { label: "Bank Account Number", value: "20739483", key: "c2-m-acc" },
                            { label: "Sort Code", value: "041404", key: "c2-m-sort" },
                            { label: "Payment Reference", value: "20092400804", key: "c2-m-ref" },
                          ].map((row) => (
                            <div
                              key={row.key}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs text-slate-500 font-medium">{row.label}</p>
                                <p className="font-mono text-base font-extrabold text-slate-900 tabular-nums">
                                  {row.value}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(row.value, row.label, row.key)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                              >
                                {copiedKey === row.key ? "✓ Copied" : "Copy"}
                              </button>
                            </div>
                          ))}
                        </div>

                        <p className="text-center text-xs text-slate-400 font-medium">
                          (Payment account solution provided by Currency Cloud)
                        </p>

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setLocation("/")}
                            className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-sm cursor-pointer"
                          >
                            I&apos;ve noted the details — Dashboard
                          </button>
                          <button
                            type="button"
                            className="w-full py-2 text-xs font-semibold text-red-600 cursor-pointer"
                          >
                            Cancel Transaction
                          </button>
                          <div className="w-28 h-1 bg-slate-300 rounded-full mx-auto mt-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* CONCEPT 3: INDIGO EXECUTIVE SPLIT-TICKET & CoP BANK GUIDE          */}
        {/* ================================================================= */}
        {(conceptFilter === "all" || conceptFilter === 3) && (
          <section
            className="space-y-5 pt-8 border-t-2 border-slate-200"
            data-testid="concept-3-section"
          >
            <div className="bg-white rounded-2xl border border-slate-200/90 px-6 py-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider">
                    Concept 03 • Executive Split-Ticket
                  </span>
                  <h2 className="font-display text-lg font-extrabold text-slate-900">
                    Indigo Split-Ticket with Confirmation-of-Payee (CoP) Guide
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Side-by-side widescreen ticket on Web (with a visual{" "}
                  <strong>&quot;Bank App Name Check: ✓ Match&quot;</strong> explainer on the left and
                  the 4 numbered bold rows on the right) and a guided step card on Mobile.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold">
                Palette: Deep Indigo • Violet • Warm Slate
              </span>
            </div>

            <div className="flex flex-col xl:flex-row items-start justify-center gap-8">
              {/* 3A. DESKTOP WEB VIEW */}
              {showWeb && (
                <div className="w-full flex-1 max-w-3xl mx-auto">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                    <Monitor className="w-4 h-4 text-indigo-600" />
                    Desktop Web View (Widescreen 2-Column Split)
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-900 via-indigo-700 to-blue-800 px-6 py-3.5 text-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setLocation("/send-money")}
                          className="text-indigo-200 hover:text-white text-xs font-semibold cursor-pointer"
                        >
                          ← Back
                        </button>
                        <span className="text-indigo-400">|</span>
                        <span className="text-xs font-bold tracking-wide uppercase">
                          Transaction #24590955 Created
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold bg-white/15 px-3 py-1 rounded-full">
                        <span>Complete payment within</span>
                        <span className="font-mono tabular-nums text-amber-300">
                          {formatTimer(secondsLeft)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 divide-x divide-slate-200">
                      {/* Left 5 Cols */}
                      <div className="col-span-5 p-6 bg-slate-50/70 flex flex-col justify-between space-y-5">
                        <div className="space-y-4">
                          <div>
                            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">
                              Amount You Pay
                            </span>
                            <p className="font-display text-4xl font-extrabold text-slate-900 tabular-nums mt-1">
                              GBP 5.00
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Recipient gets <strong className="text-slate-800">9,055.05 NGN</strong>
                            </p>
                          </div>

                          <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 space-y-2.5">
                            <p className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                              Why is this in my name?
                            </p>
                            <p className="text-xs text-indigo-900/90 leading-relaxed">
                              This is your dedicated Rhemito payment account (not your personal
                              savings). Enter the exact payee name shown on the right:
                            </p>
                            <div className="p-2.5 rounded-xl bg-white border border-indigo-200 flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {payeeName}
                              </span>
                              <span className="shrink-0 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-bold">
                                ✓ Match
                              </span>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-600 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>Details also emailed to your registered address.</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setLocation("/")}
                            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                          >
                            I&apos;ve noted the details — Dashboard
                          </button>
                          <button
                            type="button"
                            className="w-full py-1.5 text-xs font-bold text-red-600 hover:underline cursor-pointer"
                          >
                            Cancel Transaction
                          </button>
                        </div>
                      </div>

                      {/* Right 7 Cols */}
                      <div className="col-span-7 p-6 bg-white flex flex-col justify-between space-y-4">
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div>
                              <h3 className="font-display text-base font-extrabold text-slate-900">
                                Pay with Bank Transfer
                              </h3>
                              <p className="text-xs font-bold text-indigo-600">
                                Use this Account Name for your payment to us
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyAll("c3-web-all")}
                              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>{copiedKey === "c3-web-all" ? "✓ Copied All" : "Copy All"}</span>
                            </button>
                          </div>

                          <div className="rounded-xl p-4 border-2 border-indigo-600 bg-gradient-to-br from-indigo-50/80 to-white flex items-center justify-between gap-3 shadow-sm">
                            <div className="space-y-0.5">
                              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                                1. Account / Payee Name
                              </span>
                              <p className="font-display text-lg font-extrabold text-slate-950">
                                {payeeName}
                              </p>
                              <p className="text-xs font-semibold text-indigo-800">
                                (Ensure you enter this name as is in your bank account)
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(payeeName, "Account Name", "c3-web-name")}
                              className="shrink-0 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                            >
                              {copiedKey === "c3-web-name" ? "✓ Copied" : "Copy"}
                            </button>
                          </div>

                          {[
                            { num: "2", label: "Bank Account Number", value: "20739483", key: "c3-w-acc" },
                            { num: "3", label: "Sort Code", value: "041404", key: "c3-w-sort" },
                            { num: "4", label: "Payment Reference", value: "20092400804", key: "c3-w-ref" },
                          ].map((row) => (
                            <div
                              key={row.key}
                              className="px-4 py-3 rounded-xl border border-slate-200 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-semibold text-slate-500">
                                  {row.num}. {row.label}
                                </p>
                                <p className="font-mono text-lg font-extrabold text-slate-900 tabular-nums">
                                  {row.value}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(row.value, row.label, row.key)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                {copiedKey === row.key ? "✓ Copied" : "Copy"}
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-100 text-right text-xs text-slate-500 font-medium">
                          (Payment account solution provided by Currency Cloud)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3B. NATIVE MOBILE VIEW */}
              {showMobile && (
                <div className="mx-auto shrink-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    Mobile App View (iPhone 375px)
                  </div>

                  <div className="w-[375px] bg-[#F8FAFC] border-[11px] border-slate-900 rounded-[48px] shadow-2xl overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="bg-gradient-to-r from-indigo-900 via-indigo-700 to-blue-800 px-6 pt-2.5 pb-1.5 flex items-center justify-between text-xs font-bold text-white">
                        <span>9:41</span>
                        <div className="w-24 h-5 bg-black rounded-full" />
                        <span>5G 100%</span>
                      </div>

                      <div className="bg-gradient-to-r from-indigo-900 via-indigo-700 to-blue-800 px-4 pt-1 pb-4 text-white space-y-3">
                        <div className="flex items-center justify-between">
                          <button type="button" className="text-xs font-semibold text-indigo-100">
                            ← Back
                          </button>
                          <span className="text-xs font-bold">Ref #24590955</span>
                          <span className="px-2 py-0.5 rounded-full bg-white/15 text-amber-300 text-xs font-bold font-mono tabular-nums">
                            {formatTimer(secondsLeft)}
                          </span>
                        </div>

                        <div className="bg-white/10 backdrop-blur rounded-2xl p-3.5 flex items-center justify-between border border-white/15">
                          <div>
                            <p className="text-xs text-indigo-200 font-semibold">Amount to Pay</p>
                            <p className="font-display text-3xl font-extrabold text-white tabular-nums">
                              GBP 5.00
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyAll("c3-mob-all")}
                            className="px-3 py-2 rounded-xl bg-white text-indigo-900 text-xs font-extrabold shadow-xs cursor-pointer"
                          >
                            {copiedKey === "c3-mob-all" ? "✓ Copied" : "Copy All"}
                          </button>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="rounded-2xl p-3.5 border-2 border-indigo-600 bg-gradient-to-br from-indigo-50/80 to-white space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-indigo-700 uppercase">
                              1. Use this Account Name
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(payeeName, "Account Name", "c3-mob-name")}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                            >
                              {copiedKey === "c3-mob-name" ? "✓ Copied" : "Copy Name"}
                            </button>
                          </div>
                          <p className="font-display text-base font-extrabold text-slate-950 leading-snug">
                            {payeeName}
                          </p>
                          <p className="text-xs text-indigo-800 font-medium pt-1 border-t border-indigo-200/60 leading-snug">
                            (Ensure you enter this name as is in your bank account)
                          </p>
                        </div>

                        <div className="space-y-2">
                          {[
                            { num: "2", label: "Bank Account Number", value: "20739483", key: "c3-m-acc" },
                            { num: "3", label: "Sort Code", value: "041404", key: "c3-m-sort" },
                            { num: "4", label: "Payment Reference", value: "20092400804", key: "c3-m-ref" },
                          ].map((row) => (
                            <div
                              key={row.key}
                              className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-semibold text-slate-500">
                                  {row.num}. {row.label}
                                </p>
                                <p className="font-mono text-base font-extrabold text-slate-900 tabular-nums">
                                  {row.value}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(row.value, row.label, row.key)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold cursor-pointer"
                              >
                                {copiedKey === row.key ? "✓ Copied" : "Copy"}
                              </button>
                            </div>
                          ))}
                        </div>

                        <p className="text-center text-xs text-slate-400 font-medium">
                          (Payment account solution provided by Currency Cloud)
                        </p>
                      </div>
                    </div>

                    <div className="bg-white border-t border-slate-200 px-4 pt-3 pb-2">
                      <button
                        type="button"
                        onClick={() => setLocation("/")}
                        className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-sm cursor-pointer"
                      >
                        I&apos;ve noted the details — Dashboard
                      </button>
                      <button
                        type="button"
                        className="w-full py-2 text-xs font-semibold text-red-600 cursor-pointer"
                      >
                        Cancel Transaction
                      </button>
                      <div className="w-28 h-1 bg-slate-300 rounded-full mx-auto mt-1" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
