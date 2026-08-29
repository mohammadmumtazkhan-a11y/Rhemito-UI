import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Search,
  User,
  Building2,
  Plus,
  Loader2,
  ArrowRightLeft,
  AlertCircle,
  Download,
  Mail,
  QrCode,
  Share2,
  ShieldCheck,
  CalendarClock
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { knownSenders, type KnownSender } from "@/data/knownSenders";
import { PayoutAccountSelector } from "@/components/payout/PayoutAccountSelector";
import {
  createRequest, getCorridors, getRequests,
  getEligibility, getQuote, resendEmail,
  type Corridor, type PayoutAccountView, type Quote,
} from "@/lib/requests";
import { DIALING_CODES } from "@/data/dialing-codes";
import { fromMinorUnits } from "@shared/money";
import {
  computeExpiry,
  dateInTz,
  formatHumanDate,
  EXPIRY_TIMEZONE,
  EXPIRY_TIMEZONE_LABEL,
} from "@shared/invoice-logic";
import type { InvoiceExpiry } from "@shared/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Cross-currency requests settle at the LIVE spot rate at payment time — the
 * server quote endpoint provides indicative figures for previews only.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
  KES: "KSh",
  GHS: "GH₵",
  ZAR: "R",
  EGP: "E£",
  TZS: "TSh",
  UGX: "USh",
  XOF: "CFA",
  RWF: "FRw",
};

/**
 * Common currencies offered to EVERY requester — majors plus the African
 * currencies Rhemito targets. The server generates demo corridors for any of
 * these lacking a reviewed corridor for the requester's country; currencies
 * from the requester's enabled corridors are unioned in as extra options.
 */
const COMMON_CURRENCIES = [
  "GBP", "USD", "EUR",
  "NGN", "KES", "GHS", "ZAR", "EGP", "TZS", "UGX", "XOF", "RWF",
];

const EXPIRY_OPTIONS = [
  { label: "7 days", value: "7" },
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
  { label: "60 days", value: "60" },
  { label: "Custom date", value: "custom" },
];

type ExpiryPeriod = "7" | "14" | "30" | "60" | "custom";

interface FormData {
  requestAmount: string;
  senderCurrency: string;
  selectedPayoutAccountId: string;
  paymentMethod: string;
  absorbFee: boolean;
  senderType: "individual" | "business";
  senderFirstName: string;
  senderMiddleName: string;
  senderLastName: string;
  senderBusinessName: string;
  senderEmail: string;
  senderCountryCode: string;
  senderPhone: string;
  senderDob: string;
  reason: string;
  otherReason: string;
  dueDate: string;
  expiryPeriod: ExpiryPeriod;
  customExpiryDate: string;
}

// Country dialing codes come from @/data/dialing-codes (full ISO list).

const steps = [
  { id: 1, title: "Amount & Currencies", description: "Set amount & payout destination" },
  { id: 2, title: "Sender Information", description: "Who's paying you?" },
  { id: 3, title: "Review & Confirm", description: "Verify details & send" },
];

export default function RequestPayment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const requesterName = useMemo(() => {
    if (!user) return "John Doe";
    if (user.accountType === "business" && user.businessName) {
      return user.businessName;
    }
    const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
    return fullName || "John Doe";
  }, [user]);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [emailPaymentLink, setEmailPaymentLink] = useState("");
  const [createdRequestId, setCreatedRequestId] = useState("");
  const [senderSearch, setSenderSearch] = useState("");
  const [showSenderSuggestions, setShowSenderSuggestions] = useState(false);
  const [showFxNoticeModal, setShowFxNoticeModal] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [selectedPayoutAccount, setSelectedPayoutAccount] = useState<PayoutAccountView | null>(null);

  const handleSelectPayoutAccount = (account: PayoutAccountView) => {
    setSelectedPayoutAccount(account);
    setFormData(prev => ({ ...prev, selectedPayoutAccountId: account.id }));
  };

  const queryClient = useQueryClient();

  // Eligibility is server-authoritative: real session, mini-KYC passed, and a
  // verified payout account owned by the requester.
  const eligibilityQuery = useQuery<{ kind: "ok"; eligible: boolean; reasons: string[]; country: string } | { kind: "unauthenticated" }>({
    queryKey: ["/api/request-money/eligibility"],
    queryFn: async () => {
      try {
        const data = await getEligibility();
        return { kind: "ok" as const, eligible: data.eligible, reasons: data.reasons, country: data.country };
      } catch (err) {
        if ((err as { status?: number }).status === 401) return { kind: "unauthenticated" } as const;
        throw err;
      }
    },
    retry: false,
    refetchOnMount: "always",
  });

  const corridorsQuery = useQuery<Corridor[] | undefined>({
    queryKey: ["/api/request-money/corridors"],
    queryFn: async () => {
      try {
        return await getCorridors();
      } catch (err) {
        if ((err as { status?: number }).status === 401) return undefined;
        throw err;
      }
    },
    enabled: eligibilityQuery.data?.kind === "ok",
    retry: false,
    refetchOnMount: "always",
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>({
    requestAmount: "",
    senderCurrency: "GBP",
    selectedPayoutAccountId: "",
    paymentMethod: "sender_choice",
    absorbFee: true,
    senderType: "individual",
    senderFirstName: "",
    senderMiddleName: "",
    senderLastName: "",
    senderBusinessName: "",
    senderEmail: "",
    senderCountryCode: "+44",
    senderPhone: "",
    senderDob: "",
    reason: "",
    otherReason: "",
    dueDate: "",
    expiryPeriod: "30",
    customExpiryDate: "",
  });

  // Default expiry selection: 7 days after Due Date, or 30 days after the
  // request date — until the requester makes an explicit choice.
  const [expiryTouched, setExpiryTouched] = useState(false);
  useEffect(() => {
    if (!expiryTouched) {
      setFormData(prev => ({ ...prev, expiryPeriod: prev.dueDate ? "7" : "30" }));
    }
  }, [formData.dueDate, expiryTouched]);

  // Sender currency options: the common list (majors + African currencies) for
  // every requester, unioned with any extra currencies the requester's enabled
  // corridors support.
  const enabledPayInCurrencies = useMemo(() => {
    const corridors = corridorsQuery.data ?? [];
    const seen: string[] = [];
    for (const c of corridors) {
      if (c.enabled && !seen.includes(c.payInCurrency)) seen.push(c.payInCurrency);
    }
    return seen;
  }, [corridorsQuery.data]);

  const currencyOptions = useMemo(() => {
    const options = [...COMMON_CURRENCIES];
    for (const currency of enabledPayInCurrencies) {
      if (!options.includes(currency)) options.push(currency);
    }
    return options;
  }, [enabledPayInCurrencies]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const senderEmail = params.get("sender");
    if (senderEmail) {
      const sender = knownSenders.find(s => s.email === senderEmail);
      if (sender) {
        setFormData(prev => ({
          ...prev,
          senderType: sender.senderType,
          senderFirstName: sender.firstName,
          senderMiddleName: sender.middleName,
          senderLastName: sender.lastName,
          senderBusinessName: sender.businessName,
          senderEmail: sender.email,
          senderCountryCode: sender.countryCode,
          senderPhone: sender.phone,
          senderDob: sender.dob,
        }));
      }
    }
  }, []);

  const payoutCurrency = selectedPayoutAccount?.currency || "GBP";
  const senderCurrency = formData.senderCurrency;

  const filteredSenders = knownSenders.filter(sender => {
    const displayName = sender.senderType === "business"
      ? sender.businessName.toLowerCase()
      : `${sender.firstName} ${sender.middleName} ${sender.lastName}`.toLowerCase();
    const searchLower = senderSearch.toLowerCase();
    return displayName.includes(searchLower) || sender.email.toLowerCase().includes(searchLower);
  });

  const selectKnownSender = (sender: KnownSender) => {
    setFormData(prev => ({
      ...prev,
      senderType: sender.senderType,
      senderFirstName: sender.firstName,
      senderMiddleName: sender.middleName,
      senderLastName: sender.lastName,
      senderBusinessName: sender.businessName,
      senderEmail: sender.email,
      senderCountryCode: sender.countryCode,
      senderPhone: sender.phone,
      senderDob: sender.dob,
    }));
    setSenderSearch("");
    setShowSenderSuggestions(false);
  };

  // Indicative quote from the server (live-first). Cross-currency previews
  // never assume 1:1 — if no quote is available the notice stays qualitative.
  const [indicativeQuote, setIndicativeQuote] = useState<Quote | null>(null);
  const corridorForSelection = useMemo(() => {
    const corridors = corridorsQuery.data ?? [];
    return corridors.find(
      (c) => c.enabled && c.payInCurrency === senderCurrency && c.payoutCurrency === payoutCurrency,
    );
  }, [corridorsQuery.data, senderCurrency, payoutCurrency]);

  // One-shot alignment once corridors AND a payout account are known: when the
  // default currency has no enabled corridor for the selected payout account,
  // prefer the account's currency (e.g. a Kenyan requester with a KES account
  // lands on KES instead of dead-ending on the GBP default). Afterwards the
  // user's explicit choice always wins — the corridor notice informs instead.
  const currencyAlignedRef = useRef(false);
  useEffect(() => {
    if (currencyAlignedRef.current || enabledPayInCurrencies.length === 0 || !selectedPayoutAccount) return;
    currencyAlignedRef.current = true;
    if (corridorForSelection) return;
    const accountCurrency = selectedPayoutAccount.currency;
    const preferred = currencyOptions.includes(accountCurrency) ? accountCurrency : currencyOptions[0];
    setFormData(prev => ({ ...prev, senderCurrency: preferred }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledPayInCurrencies.join(","), selectedPayoutAccount, corridorForSelection]);
  useEffect(() => {
    let cancelled = false;
    if (!corridorForSelection || !formData.requestAmount || parseFloat(formData.requestAmount) <= 0) {
      setIndicativeQuote(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const q = await getQuote(corridorForSelection.id, formData.requestAmount, formData.absorbFee);
        if (!cancelled) setIndicativeQuote(q);
      } catch {
        if (!cancelled) setIndicativeQuote(null);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [corridorForSelection?.id, formData.requestAmount, formData.absorbFee]);
  const getExchangeRate = () => {
    if (senderCurrency === payoutCurrency) return 1;
    return indicativeQuote?.fxRate ?? NaN; // NaN → show "Live Spot Rate at Payout" only
  };

  const parsedAmount = parseFloat(formData.requestAmount) || 0;
  const platformFeeRate = 0.03; // 3% fee — absorbed by the requester or added to the sender's payment
  const platformFeeAmount = parsedAmount * platformFeeRate;
  const senderPaysAmount = formData.absorbFee ? parsedAmount : parsedAmount + platformFeeAmount;
  const netBeforeFx = formData.absorbFee ? parsedAmount - platformFeeAmount : parsedAmount;
  const fxRate = getExchangeRate();
  const netPayoutAmount = Number.isFinite(fxRate) ? netBeforeFx * fxRate : 0;

  const senderSymbol = CURRENCY_SYMBOLS[senderCurrency] || "";
  const payoutSymbol = CURRENCY_SYMBOLS[payoutCurrency] || "";

  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * The Due Date and the custom expiry date can never conflict: moving the Due
   * Date past an existing custom expiry bumps that expiry up to the Due Date,
   * and a custom expiry entered before the Due Date is normalised up to it.
   * (The backend still validates the rule authoritatively.)
   */
  const handleDueDateChange = (value: string) => {
    setFormData((prev) => {
      const next = { ...prev, dueDate: value };
      if (
        value &&
        prev.expiryPeriod === "custom" &&
        prev.customExpiryDate &&
        prev.customExpiryDate < value
      ) {
        next.customExpiryDate = value;
      }
      return next;
    });
  };

  const handleCustomExpiryChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      customExpiryDate: value && prev.dueDate && value < prev.dueDate ? prev.dueDate : value,
    }));
  };

  const expirySelection: InvoiceExpiry = useMemo(() => {
    if (formData.expiryPeriod === "custom") {
      return { type: "custom", date: formData.customExpiryDate };
    }
    return { type: "preset", days: Number(formData.expiryPeriod) as 7 | 14 | 30 | 60 };
  }, [formData.expiryPeriod, formData.customExpiryDate]);

  const computedExpiry = useMemo(() => {
    if (formData.expiryPeriod === "custom" && !formData.customExpiryDate) return null;
    return computeExpiry(formData.dueDate || null, expirySelection, new Date());
  }, [formData.dueDate, formData.expiryPeriod, formData.customExpiryDate, expirySelection]);

  // Client-side mirror of the backend validation (backend is authoritative).
  // Computed live so problems surface as the requester types, not only on submit.
  const dateErrors = useMemo(() => {
    const errors: { dueDate?: string; expiry?: string } = {};
    const today = dateInTz(new Date(), EXPIRY_TIMEZONE);

    if (formData.dueDate && formData.dueDate < today) {
      errors.dueDate = "The Due Date cannot be in the past.";
    }
    if (!computedExpiry) {
      errors.expiry = "Select a future Payment Link Expiry Date.";
      return errors;
    }
    if (computedExpiry.expiryDate <= today) {
      errors.expiry = "Select a future Payment Link Expiry Date.";
    } else if (formData.dueDate && computedExpiry.expiryDate < formData.dueDate) {
      // Defensive: the inputs above normalise the dates so this cannot normally
      // occur — kept as a safety net before the backend's authoritative check.
      errors.expiry = "The Payment Link Expiry Date cannot be earlier than the Due Date.";
    }
    return errors;
  }, [formData.dueDate, formData.expiryPeriod, formData.customExpiryDate, computedExpiry]);

  const today = useMemo(() => dateInTz(new Date(), EXPIRY_TIMEZONE), []);

  const handleSubmitRequest = async () => {
    if (isSubmittingRequest || !corridorForSelection || !selectedPayoutAccount) return;
    setIsSubmittingRequest(true);
    try {
      const preferredLabel =
        formData.paymentMethod === "sender_choice" ? null : formData.paymentMethod.replace(/_/g, " ");
      const result = await createRequest({
        corridorId: corridorForSelection.id,
        payoutAccountId: selectedPayoutAccount.id,
        payInAmount: parsedAmount.toFixed(2),
        senderType: formData.senderType,
        senderName:
          formData.senderType === "business"
            ? formData.senderBusinessName
            : [formData.senderFirstName, formData.senderMiddleName, formData.senderLastName].filter(Boolean).join(" "),
        senderEmail: formData.senderEmail,
        senderPhone: formData.senderPhone ? `${formData.senderCountryCode} ${formData.senderPhone}` : undefined,
        senderDob: formData.senderType === "individual" && formData.senderDob ? formData.senderDob : undefined,
        purpose: formData.reason as never,
        reference: [
          preferredLabel ? `Preferred: ${preferredLabel}` : null,
          formData.reason === "other" && formData.otherReason.trim() ? `Reason: ${formData.otherReason.trim()}` : null,
        ].filter(Boolean).join(" | ") || undefined,
        absorbFee: formData.absorbFee,
        dueDate: formData.dueDate || undefined,
        expiry: expirySelection,
        idempotencyKey: idempotencyKeyRef.current,
      });
      setPaymentLink(result.checkoutUrl);
      setEmailPaymentLink(result.emailCheckoutUrl || result.checkoutUrl);
      setCreatedRequestId(result.request.id);
      setIsSuccess(true);
    } catch (err) {
      // Surface the real reason for every failure shape — server error JSON,
      // network TypeErrors and any stray non-Error throwable — so the user is
      // never left with a dead-end message.
      const description =
        (err instanceof Error ? err.message : undefined) ??
        (typeof err === "string" ? err : undefined) ??
        (typeof (err as { message?: unknown })?.message === "string" ? (err as { message: string }).message : undefined) ??
        "Something went wrong. Please try again.";
      toast({
        title: "Request not generated",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!selectedPayoutAccount || selectedPayoutAccount.verificationStatus !== "verified") {
        toast({
          title: "Active Settlement Bank Account Required",
          description: "Please add or select a verified destination settlement bank account before proceeding.",
          variant: "destructive",
        });
        return;
      }
      if (parsedAmount <= 0) {
        toast({
          title: "Amount Required",
          description: "Please enter an amount to request.",
          variant: "destructive",
        });
        return;
      }
      if (!corridorForSelection) {
        toast({
          title: "Corridor Unavailable",
          description: "This currency route is currently unavailable for your account.",
          variant: "destructive",
        });
        return;
      }
      if (senderCurrency !== payoutCurrency) {
        setShowFxNoticeModal(true);
        return;
      }
      setCurrentStep(2);
    } else if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      void handleSubmitRequest();
    }
  };

  const handleConfirmFxAndProceed = () => {
    setShowFxNoticeModal(false);
    setCurrentStep(2);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setLocation("/");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    setCopied(true);
    toast({ title: "Link Copied!", description: "Payment link has been copied to your clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Rhemito money request", text: "Please pay this Rhemito request", url: paymentLink });
      } catch {
        // user cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const handleResendEmail = async () => {
    if (!createdRequestId) return;
    try {
      await resendEmail(createdRequestId);
      toast({ title: "Email sent", description: `The money request email was sent to ${formData.senderEmail}.` });
    } catch (err) {
      toast({
        title: "Email not sent",
        description: err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          parsedAmount > 0 &&
          !!selectedPayoutAccount &&
          selectedPayoutAccount.verificationStatus === "verified" &&
          !!corridorForSelection
        );
      case 2:
        // Purpose of payment is mandatory for cross-border compliance.
        return (
          !!formData.senderEmail &&
          !!formData.reason &&
          (formData.reason !== "other" || !!formData.otherReason.trim()) &&
          (formData.senderType === "individual" ? !!formData.senderFirstName : !!formData.senderBusinessName) &&
          Object.keys(dateErrors).length === 0
        );
      case 3:
        return !isSubmittingRequest;
      default:
        return false;
    }
  };


  // Server-authoritative eligibility gates
  if (eligibilityQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-20 text-center text-muted-foreground text-sm">Checking your eligibility…</div>
      </DashboardLayout>
    );
  }



  if (isSuccess) {
    return (
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto mt-10 md:mt-14"
        >
          <Card className="text-center shadow-lg border-teal/20">
            <CardContent className="pt-10 pb-8 space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.15 }}
                className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mx-auto shadow-md"
              >
                <CheckCircle2 className="w-9 h-9 text-white" />
              </motion.div>

              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold font-display text-slate-900">Money Request Sent!</h2>
                <p className="text-sm text-muted-foreground">
                  The payment link has been sent to{" "}
                  <span className="font-semibold text-foreground">{formData.senderEmail}</span> for{" "}
                  <span className="font-semibold text-foreground">
                    {formData.senderType === "business"
                      ? formData.senderBusinessName
                      : [formData.senderFirstName, formData.senderMiddleName, formData.senderLastName].filter(Boolean).join(" ")}
                  </span>.
                </p>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl space-y-2 text-left border border-border">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Requested Amount:</span>
                  <span className="font-medium text-foreground">{senderSymbol}{parsedAmount.toFixed(2)} {senderCurrency}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Sender Pays:</span>
                  <span className="font-medium text-foreground">{senderSymbol}{senderPaysAmount.toFixed(2)} {senderCurrency}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fee (3%{formData.absorbFee ? " absorbed by you" : " added to sender"}):</span>
                  <span className="font-medium text-foreground">{formData.absorbFee ? "-" : "+"}{senderSymbol}{platformFeeAmount.toFixed(2)} {senderCurrency}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-border/60">
                  <span className="text-primary">You Receive in Bank:</span>
                  <span className="text-primary font-bold">
                    {senderCurrency === payoutCurrency
                      ? `${payoutSymbol}${netBeforeFx.toFixed(2)} ${payoutCurrency}`
                      : `${senderSymbol}${netBeforeFx.toFixed(2)} ${senderCurrency}`}
                  </span>
                </div>
                {senderCurrency !== payoutCurrency && (
                  <p className="text-[11px] text-amber-800 font-medium">
                    Converted to {payoutCurrency} on FX spot rate when payment is completed.
                  </p>
                )}
                <div className="text-[11px] text-muted-foreground">
                  Payout to: {selectedPayoutAccount?.bankName} ({payoutCurrency})
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary/5 to-teal/5 rounded-xl p-4 space-y-4 border border-primary/10" data-testid="qr-panel">
                {/* 1. Copyable Link */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800">Copyable Payment Link (Share with anyone)</p>
                    <span className="text-[10px] text-muted-foreground">General Payer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={paymentLink}
                      readOnly
                      className="text-sm bg-white font-mono"
                      data-testid="input-payment-link"
                    />
                    <Button
                      onClick={handleCopyLink}
                      variant="outline"
                      className="shrink-0 gap-1.5"
                      data-testid="button-copy-link"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                </div>

                {/* 2. Email-Notification Link */}
                {emailPaymentLink && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-800">Email Notification Link (Pre-linked to recipient)</p>
                      <span className="text-[10px] text-teal-700 font-mono">Masked recipient</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={emailPaymentLink}
                        readOnly
                        className="text-sm bg-white font-mono text-xs"
                        data-testid="input-email-payment-link"
                      />
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(emailPaymentLink);
                          setCopiedEmail(true);
                          toast({ title: "Email Link Copied!", description: "Recipient notification link copied to clipboard." });
                          setTimeout(() => setCopiedEmail(false), 2000);
                        }}
                        variant="outline"
                        className="shrink-0 gap-1.5"
                        data-testid="button-copy-email-link"
                      >
                        {copiedEmail ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedEmail ? "Copied" : "Copy"}</span>
                      </Button>
                    </div>
                  </div>
                )}

                {createdRequestId && (
                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                    <img
                      src={`/api/request-money/requests/${createdRequestId}/qr.png`}
                      alt={`QR code for money request`}
                      className="w-36 h-36 border border-border rounded-xl bg-white"
                      data-testid="img-qr"
                    />
                    <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                      <Button variant="outline" size="sm" onClick={handleShareLink} data-testid="button-share">
                        <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(`/api/request-money/requests/${createdRequestId}/qr.png`, "_blank")} data-testid="button-download-qr-png">
                        <Download className="w-3.5 h-3.5 mr-1.5" /> QR (PNG)
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(`/api/request-money/requests/${createdRequestId}/qr.svg`, "_blank")} data-testid="button-download-qr-svg">
                        <QrCode className="w-3.5 h-3.5 mr-1.5" /> QR (SVG)
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleResendEmail} data-testid="button-resend-email">
                        <Mail className="w-3.5 h-3.5 mr-1.5" /> Send email
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  On mobile the link opens the checkout directly — no QR scanning needed. The QR contains only the secure payment link.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLocation("/")}
                  data-testid="button-back-to-dashboard"
                >
                  Back to Dashboard
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => {
                    setFormData({
                      requestAmount: "",
                      senderCurrency: "GBP",
                      selectedPayoutAccountId: "",
                      paymentMethod: "sender_choice",
                      absorbFee: true,
                      senderType: "individual",
                      senderFirstName: "",
                      senderMiddleName: "",
                      senderLastName: "",
                      senderBusinessName: "",
                      senderEmail: "",
                      senderCountryCode: "+44",
                      senderPhone: "",
                      senderDob: "",
                      reason: "",
                      otherReason: "",
                      dueDate: "",
                      expiryPeriod: "30",
                      customExpiryDate: "",
                    });
                    setSelectedPayoutAccount(null);
                    setCurrentStep(1);
                    setIsSuccess(false);
                    setPaymentLink("");
                    setCreatedRequestId("");
                    setExpiryTouched(false);
                    currencyAlignedRef.current = false;
                    idempotencyKeyRef.current = crypto.randomUUID();
                  }}
                  data-testid="button-new-request"
                >
                  New Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-24">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 md:mb-6"
        >
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-2 md:mb-3 -ml-2 text-sm text-muted-foreground hover:text-foreground"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-1 md:mr-2" />
            Back
          </Button>

          <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900">Receive Money</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Receive money from customers or clients worldwide with instant payout</p>
        </motion.div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6 md:mb-8 overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <div className="flex items-center gap-2 md:gap-3">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: currentStep >= step.id ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    color: currentStep >= step.id ? "white" : "hsl(var(--muted-foreground))",
                  }}
                  className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-semibold"
                >
                  {currentStep > step.id ? <Check className="w-3.5 h-3.5 md:w-4 md:h-4" /> : step.id}
                </motion.div>
                <div>
                  <p className={`text-xs md:text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.title}
                  </p>
                  <p className="hidden sm:block text-[11px] text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 md:w-16 h-0.5 mx-2 md:mx-4 ${currentStep > step.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.18 }}
          >
            <Card className="border-border shadow-sm">
              <CardHeader className="px-5 md:px-6 py-4 md:py-5 border-b border-border/50">
                <CardTitle className="font-display text-base md:text-lg">{steps[currentStep - 1].title}</CardTitle>
                <CardDescription className="text-xs md:text-sm">{steps[currentStep - 1].description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-5 md:px-6 pt-6">

                {/* ================= STEP 1: AMOUNT & CURRENCY ================= */}
                {currentStep === 1 && (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-6">

                      {/* Receiving Payout Account */}
                      <PayoutAccountSelector
                        requesterName={requesterName}
                        selectedAccountId={selectedPayoutAccount?.id ?? ""}
                        onSelect={handleSelectPayoutAccount}
                        context="request"
                      />

                      {(!selectedPayoutAccount || selectedPayoutAccount.verificationStatus !== "verified") && (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 font-medium" data-testid="alert-payout-account-required">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-amber-950">Active Destination Settlement Bank Account Required</p>
                            <p className="text-[11px] text-amber-900/80 mt-0.5">
                              You cannot proceed with a money request without an active, verified destination settlement bank account. Please select or add an account above.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Request Amount Input */}
                      <div className="bg-gradient-to-br from-primary/5 to-teal/5 rounded-xl p-5 space-y-4 border border-primary/10">
                        <div className="space-y-2">
                          <Label htmlFor="requestAmount" className="text-sm font-semibold text-slate-800">
                            Amount to Request from Sender *
                          </Label>
                          <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                              {senderSymbol}
                            </span>
                            <Input
                              id="requestAmount"
                              type="number"
                              min="1"
                              step="any"
                              placeholder="0.00"
                              value={formData.requestAmount}
                              onChange={(e) => handleInputChange("requestAmount", e.target.value)}
                              className={`${senderSymbol.length > 1 ? "pl-14" : "pl-8"} text-xl md:text-2xl font-bold h-12 md:h-14 bg-white shadow-sm`}
                              data-testid="input-request-amount"
                            />
                          </div>
                            <Select
                              value={formData.senderCurrency}
                              onValueChange={(value) => handleInputChange("senderCurrency", value)}
                            >
                              <SelectTrigger className="w-24 md:w-28 h-12 md:h-14 bg-white font-bold text-base shadow-sm" data-testid="select-sender-currency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {currencyOptions.map(currency => (
                                  <SelectItem key={currency} value={currency}>
                                    {currency} ({CURRENCY_SYMBOLS[currency] ?? ""})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            The sender will be billed in <strong>{senderCurrency}</strong>.
                          </p>
                          {parsedAmount > 0 && !corridorForSelection && (
                            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5" data-testid="corridor-unavailable">
                              This sender currency / settlement bank account combination has no enabled corridor.{" "}
                              {(() => {
                                const disabled = (corridorsQuery.data ?? []).find(c => !c.enabled && c.payInCurrency === senderCurrency && c.payoutCurrency === payoutCurrency);
                                return disabled?.unavailabilityReason ?? "Try a different currency or settlement bank account.";
                              })()}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Fee Absorption Checkbox */}
                      {parsedAmount > 0 && (
                        <div className="flex items-start space-x-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors" data-testid="absorb-fee-section">
                          <Checkbox
                            id="absorbFee"
                            checked={formData.absorbFee}
                            onCheckedChange={(checked) => handleInputChange("absorbFee", checked === true)}
                            data-testid="checkbox-absorb-fee"
                            className="mt-0.5"
                          />
                          <div className="grid gap-1 leading-none cursor-pointer" onClick={() => handleInputChange("absorbFee", !formData.absorbFee)}>
                            <Label
                              htmlFor="absorbFee"
                              className="text-sm font-semibold cursor-pointer text-slate-900"
                            >
                              Absorb the 3% transaction fee
                            </Label>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {formData.absorbFee
                                ? `The sender pays the exact amount you requested (${senderSymbol}${parsedAmount.toFixed(2)} ${senderCurrency}), and the 3% fee is deducted from the amount you receive.`
                                : `The 3% fee (${senderSymbol}${platformFeeAmount.toFixed(2)} ${senderCurrency}) is added to the sender's payment (${senderSymbol}${senderPaysAmount.toFixed(2)} ${senderCurrency} total), and you receive the full requested amount.`}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Optional Payment Method */}
                      <div className="space-y-2">
                        <Label htmlFor="paymentMethod" className="text-sm font-medium">
                          Preferred Payment Method (Optional)
                        </Label>
                        <Select
                          value={formData.paymentMethod}
                          onValueChange={(value) => handleInputChange("paymentMethod", value)}
                        >
                          <SelectTrigger id="paymentMethod" data-testid="select-payment-method" className="h-11">
                            <SelectValue placeholder="How will the sender pay?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sender_choice">Let the Sender Choose</SelectItem>
                            <SelectItem value="card">Card Payment (Debit/Credit)</SelectItem>
                            <SelectItem value="bank_transfer">Instant Bank Transfer</SelectItem>
                            <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Right Column: Dynamic Fee & Payout Sidebar */}
                    <div className="lg:col-span-2 lg:self-start lg:sticky lg:top-24">
                      <div className="border border-border rounded-xl p-5 space-y-4 bg-white shadow-sm" data-testid="fee-breakdown">
                        <h3 className="font-semibold text-base text-slate-900 border-b pb-2">Calculation Breakdown</h3>

                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Sender Pays:</span>
                            <span className="font-bold text-slate-800" data-testid="breakdown-sender-pays">
                              {senderSymbol}{senderPaysAmount.toFixed(2)} {senderCurrency}
                            </span>
                          </div>

                          <div className="flex justify-between text-muted-foreground">
                            <span>Fee (3%{formData.absorbFee ? " absorbed by you" : " added to sender"}):</span>
                            <span className={`font-medium ${formData.absorbFee ? "text-red-600" : "text-slate-800"}`}>
                              {formData.absorbFee ? "-" : "+"}{senderSymbol}{platformFeeAmount.toFixed(2)} {senderCurrency}
                            </span>
                          </div>

                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Net before FX:</span>
                            <span className="font-semibold text-slate-700">{senderSymbol}{netBeforeFx.toFixed(2)} {senderCurrency}</span>
                          </div>

                          {senderCurrency !== payoutCurrency && (
                            <div className="flex items-center justify-between text-xs bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-900">
                              <span className="font-medium">FX Conversion:</span>
                              <span className="font-semibold">Live Spot Rate at Payout</span>
                            </div>
                          )}
                        </div>

                        <div className="h-px bg-border" />

                        <div className="bg-primary/5 -mx-5 px-5 py-3.5 -mb-5 rounded-b-xl border-t border-primary/15">
                          <p className="text-xs text-muted-foreground mb-0.5">You Receive in Bank ({payoutCurrency}):</p>
                          {senderCurrency === payoutCurrency ? (
                            <div className="flex items-baseline justify-between">
                              <span className="text-xl md:text-2xl font-extrabold text-primary">
                                {payoutSymbol}{netBeforeFx.toFixed(2)}
                              </span>
                              <span className="text-xs font-bold text-primary">{payoutCurrency}</span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-baseline justify-between">
                                <span className="text-xl md:text-2xl font-extrabold text-primary">
                                  {senderSymbol}{netBeforeFx.toFixed(2)}
                                </span>
                                <span className="text-xs font-bold text-slate-600">{senderCurrency}</span>
                              </div>
                              <p className="text-[11px] font-medium text-amber-800 mt-1 leading-snug">
                                Converted to {payoutCurrency} at live spot rate when sender pays
                              </p>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            Deposited to {selectedPayoutAccount?.bankName || "Default Account"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= STEP 2: SENDER DETAILS ================= */}
                {currentStep === 2 && (
                  <div className="max-w-2xl mx-auto space-y-6">
                    {/* Search Known Senders */}
                    <div className="space-y-2 relative">
                      <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Search Existing Sender
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          ref={searchInputRef}
                          placeholder="Search saved senders by name or email..."
                          value={senderSearch}
                          onChange={(e) => {
                            setSenderSearch(e.target.value);
                            setShowSenderSuggestions(true);
                          }}
                          onFocus={() => setShowSenderSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSenderSuggestions(false), 200)}
                          className="pl-9 bg-slate-50"
                          data-testid="input-sender-search"
                          autoComplete="off"
                        />
                      </div>
                      <AnimatePresence>
                        {showSenderSuggestions && senderSearch && filteredSenders.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-56 overflow-auto"
                          >
                            {filteredSenders.map((sender) => (
                              <button
                                key={sender.email}
                                type="button"
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 border-b last:border-b-0"
                                onClick={() => selectKnownSender(sender)}
                                data-testid={`suggestion-sender-${sender.email.replace(/[@.]/g, '-')}`}
                              >
                                <div className="w-9 h-9 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                                  {sender.senderType === "business" ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                </div>
                                <div className="truncate">
                                  <p className="font-medium text-sm text-foreground">
                                    {sender.senderType === "business"
                                      ? sender.businessName
                                      : `${sender.firstName} ${sender.middleName} ${sender.lastName}`.trim()}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{sender.email}</p>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Sender Type Toggle */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Sender Type *</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleInputChange("senderType", "individual")}
                          className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border-2 transition-all ${
                            formData.senderType === "individual"
                              ? "border-primary bg-primary/5 font-semibold text-primary"
                              : "border-border hover:border-slate-300 text-slate-700"
                          }`}
                          data-testid="button-sender-type-individual"
                        >
                          <User className="w-4 h-4" />
                          <span>Individual</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange("senderType", "business");
                            handleInputChange("senderDob", "");
                          }}
                          className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border-2 transition-all ${
                            formData.senderType === "business"
                              ? "border-primary bg-primary/5 font-semibold text-primary"
                              : "border-border hover:border-slate-300 text-slate-700"
                          }`}
                          data-testid="button-sender-type-business"
                        >
                          <Building2 className="w-4 h-4" />
                          <span>Business</span>
                        </button>
                      </div>
                    </div>

                    {/* Names Form */}
                    {formData.senderType === "individual" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="senderFirstName" className="text-xs font-medium">First Name *</Label>
                          <Input
                            id="senderFirstName"
                            placeholder="First name"
                            value={formData.senderFirstName}
                            onChange={(e) => handleInputChange("senderFirstName", e.target.value)}
                            data-testid="input-sender-first-name"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="senderMiddleName" className="text-xs font-medium">Middle Name (Optional)</Label>
                          <Input
                            id="senderMiddleName"
                            placeholder="Middle name"
                            value={formData.senderMiddleName}
                            onChange={(e) => handleInputChange("senderMiddleName", e.target.value)}
                            data-testid="input-sender-middle-name"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="senderLastName" className="text-xs font-medium">Last Name</Label>
                          <Input
                            id="senderLastName"
                            placeholder="Last name"
                            value={formData.senderLastName}
                            onChange={(e) => handleInputChange("senderLastName", e.target.value)}
                            data-testid="input-sender-last-name"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label htmlFor="senderBusinessName" className="text-xs font-medium">Business Name *</Label>
                        <Input
                          id="senderBusinessName"
                          placeholder="e.g. Acme Corp Ltd"
                          value={formData.senderBusinessName}
                          onChange={(e) => handleInputChange("senderBusinessName", e.target.value)}
                          data-testid="input-sender-business-name"
                        />
                      </div>
                    )}

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="senderEmail" className="text-xs font-medium">Sender Email Address *</Label>
                      <Input
                        id="senderEmail"
                        type="email"
                        placeholder="sender@example.com"
                        value={formData.senderEmail}
                        onChange={(e) => handleInputChange("senderEmail", e.target.value)}
                        data-testid="input-sender-email"
                      />
                    </div>

                    {/* Phone (Optional) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="senderPhone" className="text-xs font-medium">Sender Mobile Number</Label>
                        <span className="text-[11px] text-muted-foreground">Optional</span>
                      </div>
                      <div className="flex gap-2">
                        <Select
                          value={formData.senderCountryCode}
                          onValueChange={(value) => handleInputChange("senderCountryCode", value)}
                        >
                          <SelectTrigger className="w-36" data-testid="select-country-code">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {DIALING_CODES.map((country) => (
                              <SelectItem key={country.value} value={country.value}>
                                {country.flag} {country.code} {country.country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          id="senderPhone"
                          type="tel"
                          placeholder="e.g. 7123456789"
                          value={formData.senderPhone}
                          onChange={(e) => handleInputChange("senderPhone", e.target.value)}
                          className="flex-1"
                          data-testid="input-sender-phone"
                        />
                      </div>
                    </div>

                    {/* Date of Birth (Optional) */}
                    {formData.senderType === "individual" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="senderDob" className="text-xs font-medium">Sender Date of Birth</Label>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">Optional</Badge>
                        </div>
                        <Input
                          id="senderDob"
                          type="date"
                          value={formData.senderDob}
                          onChange={(e) => handleInputChange("senderDob", e.target.value)}
                          data-testid="input-sender-dob"
                        />
                      </div>
                    )}

                    {/* Reason for Payment — mandatory for cross-border compliance */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="reason" className="text-xs font-medium">
                          Reason for Payment <span className="text-destructive">*</span>
                        </Label>
                      </div>
                      <Select
                        value={formData.reason}
                        onValueChange={(value) => handleInputChange("reason", value)}
                      >
                        <SelectTrigger id="reason" data-testid="select-reason">
                          <SelectValue placeholder="Select a payment category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invoice_payment">Invoice / Services</SelectItem>
                          <SelectItem value="business_payment">Business Payment</SelectItem>
                          <SelectItem value="family_support">Family Support</SelectItem>
                          <SelectItem value="education_fees">Education / Tuition</SelectItem>
                          <SelectItem value="medical_expenses">Medical Expenses</SelectItem>
                          <SelectItem value="rent_payment">Rent Payment</SelectItem>
                          <SelectItem value="gift">Gift / Donation</SelectItem>
                          <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.reason === "other" && (
                      <div className="space-y-1.5" data-testid="container-other-reason">
                        <Label htmlFor="otherReason" className="text-xs font-medium">
                          Please specify reason <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="otherReason"
                          placeholder="e.g. Consulting services, Event sponsorship, etc."
                          value={formData.otherReason}
                          onChange={(e) => handleInputChange("otherReason", e.target.value)}
                          className="h-10 text-sm"
                          data-testid="input-other-reason"
                          required
                        />
                      </div>
                    )}

                    <div className="h-px bg-border" />

                    {/* Due Date (Optional) */}
                    <div className="space-y-1.5">
                      <Label htmlFor="dueDate" className="text-xs font-medium">Due Date (Optional)</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        min={today}
                        value={formData.dueDate}
                        onChange={(e) => handleDueDateChange(e.target.value)}
                        data-testid="input-due-date"
                      />
                      <p className="text-xs text-muted-foreground">
                        The date by which you expect the sender to make payment. Payment may still be made after this
                        date until the payment link expires.
                      </p>
                      {dateErrors.dueDate && (
                        <p className="text-xs text-destructive" data-testid="error-due-date">{dateErrors.dueDate}</p>
                      )}
                    </div>

                    {/* Payment Link Expiry (required) */}
                    <div className="space-y-1.5">
                      <Label htmlFor="expiryPeriod" className="text-xs font-medium">
                        Payment Link Expiry <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.expiryPeriod}
                        onValueChange={(value) => {
                          setExpiryTouched(true);
                          handleInputChange("expiryPeriod", value as ExpiryPeriod);
                        }}
                      >
                        <SelectTrigger id="expiryPeriod" data-testid="select-expiry-period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPIRY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        After this date, the sender will no longer be able to start a payment using this link.
                      </p>

                      {formData.expiryPeriod === "custom" && (
                        <div className="space-y-1.5 pt-1">
                          <Label htmlFor="customExpiryDate" className="text-xs font-medium">Expiry Date</Label>
                          <Input
                            id="customExpiryDate"
                            type="date"
                            min={formData.dueDate || today}
                            value={formData.customExpiryDate}
                            onChange={(e) => handleCustomExpiryChange(e.target.value)}
                            data-testid="input-custom-expiry-date"
                          />
                        </div>
                      )}

                      {computedExpiry && (
                        <p className="text-xs font-medium text-primary flex items-center gap-1.5 pt-1" data-testid="text-expiry-preview">
                          <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                          This payment link will expire on {formatHumanDate(computedExpiry.expiryDate)} at 11:59 p.m.{" "}
                          {EXPIRY_TIMEZONE_LABEL}.
                        </p>
                      )}
                      {dateErrors.expiry && (
                        <p className="text-xs text-destructive" data-testid="error-expiry">{dateErrors.expiry}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ================= STEP 3: REVIEW & CONFIRM ================= */}
                {currentStep === 3 && (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 md:p-6 space-y-5">
                      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold">Sender Pays</p>
                          <p className="text-2xl font-bold text-slate-900 mt-0.5" data-testid="review-sender-pays">
                            {senderSymbol}{senderPaysAmount.toFixed(2)} {senderCurrency}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold">You Receive in Bank</p>
                          <p className="text-2xl font-bold text-primary mt-0.5">
                            {senderCurrency === payoutCurrency
                              ? `${payoutSymbol}${netBeforeFx.toFixed(2)} ${payoutCurrency}`
                              : `${senderSymbol}${netBeforeFx.toFixed(2)} ${senderCurrency}`}
                          </p>
                          {senderCurrency !== payoutCurrency && (
                            <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                              Converted to {payoutCurrency} on live spot rate upon payment
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-muted-foreground">Platform Fee (3%{formData.absorbFee ? " absorbed by you" : " added to sender"}):</span>
                          <span className={`font-medium ${formData.absorbFee ? "text-red-600" : "text-slate-800"}`}>
                            {formData.absorbFee ? "-" : "+"}{senderSymbol}{platformFeeAmount.toFixed(2)} {senderCurrency}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-muted-foreground">Net Payout Amount:</span>
                          <span className="font-semibold text-slate-800">{senderSymbol}{netBeforeFx.toFixed(2)} {senderCurrency}</span>
                        </div>

                        {senderCurrency !== payoutCurrency && (
                          <div className="flex justify-between py-1 border-b border-slate-100 text-amber-900 bg-amber-50/70 px-2 py-1.5 rounded">
                            <span className="font-medium text-xs">FX Conversion:</span>
                            <span className="font-semibold text-xs">Applied at live spot rate upon payout</span>
                          </div>
                        )}

                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-muted-foreground">Destination Settlement Bank Account:</span>
                          <span className="font-semibold text-slate-800">
                            {selectedPayoutAccount?.bankName} ({payoutCurrency})
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-muted-foreground">Sender:</span>
                          <span className="font-medium text-slate-800">
                            {formData.senderType === "business"
                              ? formData.senderBusinessName
                              : [formData.senderFirstName, formData.senderMiddleName, formData.senderLastName].filter(Boolean).join(" ")}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-muted-foreground">Sender Email:</span>
                          <span className="font-medium text-slate-800">{formData.senderEmail}</span>
                        </div>

                        {formData.senderPhone && (
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-muted-foreground">Sender Phone:</span>
                            <span className="font-medium">{formData.senderCountryCode} {formData.senderPhone}</span>
                          </div>
                        )}

                        {formData.senderType === "individual" && formData.senderDob && (
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-muted-foreground">Sender DOB:</span>
                            <span className="font-medium">{formData.senderDob}</span>
                          </div>
                        )}

                        {formData.reason && (
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-muted-foreground">Reason:</span>
                            <span className="font-medium">
                              {formData.reason === "other" && formData.otherReason.trim()
                                ? `Other (${formData.otherReason.trim()})`
                                : formData.reason.replace(/_/g, " ")}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-muted-foreground">Due Date:</span>
                          <span className="font-medium" data-testid="review-due-date">
                            {formData.dueDate ? formatHumanDate(formData.dueDate) : "No due date"}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-muted-foreground">Payment Link Expiry Date:</span>
                          <span className="font-medium" data-testid="review-expiry-date">
                            {computedExpiry
                              ? `${formatHumanDate(computedExpiry.expiryDate)} at 11:59 p.m. ${EXPIRY_TIMEZONE_LABEL} (${computedExpiry.expiryDate})`
                              : "—"}
                          </span>
                        </div>

                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Payment Method:</span>
                          <span className="font-medium capitalize">{formData.paymentMethod.replace("_", " ")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>Security Reminder:</strong> Ensure you communicate directly with your sender to verify this request.
                        Funds will be automatically credited to your destination bank account once paid.
                      </p>
                    </div>
                  </div>
                )}

                {/* Step Navigation Buttons */}
                <div className="flex gap-3 pt-4 border-t border-border/60">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1"
                    data-testid="button-step-back"
                  >
                    {currentStep === 1 ? "Cancel" : "Back"}
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="flex-1 bg-primary hover:bg-primary/90"
                    data-testid="button-step-next"
                  >
                    {currentStep === 3 ? "Generate Payment Link" : "Continue"}
                    {currentStep < 3 && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* FX Conversion Notice Modal */}
      <Dialog open={showFxNoticeModal} onOpenChange={setShowFxNoticeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-slate-900">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <span>FX Conversion Notice</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cross-currency payout information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  As your settlement bank account currency (<strong>{payoutCurrency}</strong>) is different from the requested amount currency (<strong>{senderCurrency}</strong>), the FX conversion will be done on the <strong>FX Spot rates at the time of payout</strong>.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requested Amount (Sender Pays):</span>
                <span className="font-semibold text-slate-800">{senderSymbol}{senderPaysAmount.toFixed(2)} {senderCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee (3%{formData.absorbFee ? " absorbed by you" : " added to sender"}):</span>
                <span className={`font-medium ${formData.absorbFee ? "text-red-600" : "text-slate-800"}`}>
                  {formData.absorbFee ? "-" : "+"}{senderSymbol}{platformFeeAmount.toFixed(2)} {senderCurrency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Payout Amount:</span>
                <span className="font-semibold text-slate-800">{senderSymbol}{netBeforeFx.toFixed(2)} {senderCurrency}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200/60">
                <span className="text-muted-foreground">Destination Settlement Bank Account:</span>
                <span className="font-semibold text-slate-800">{selectedPayoutAccount?.bankName} ({payoutCurrency})</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFxNoticeModal(false)}
            >
              Go Back
            </Button>
            <Button
              type="button"
              onClick={handleConfirmFxAndProceed}
              className="bg-primary hover:bg-primary/90 gap-1.5"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
