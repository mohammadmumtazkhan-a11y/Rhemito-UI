/**
 * Public payment-request checkout — /pay/:token & /pay/e/:emailToken.
 *
 * Full Sender / Payer Journey (Mito Hosted / Rhemito Payment):
 * 1. Initial Summary Card (SenderScreen-1): Payment breakdown + solid blue "Pay now".
 * 2. Email Verification (SenderScreen-2, 3, 4):
 *    - Copied link (/pay/:token): Shows ONLY Email + "Send code" initially.
 *      After sending the 6-digit code:
 *      - If email is already known/registered: shows ONLY Confirmation code + "Verify and pay" (no password, no mini-KYC).
 *      - If email is new to Mito: reveals "New to Mito? [Individual | Business]", First name, Last name, Gender + Confirmation code + "Verify and pay".
 *    - Email link (/pay/e/:emailToken): Payer arrived directly from their email inbox, so 6-digit email OTP is skipped.
 *      - If sender details are already known: "Pay now" continues directly to the payment flow.
 *      - If sender is brand new (no name on file): collects only "New to Mito?" details without OTP.
 * 3. Desktop QR Handoff (SenderScreen-5): "Continue on your phone" QR code or "Continue on this browser instead".
 * 4. Payment Method Selection (SenderScreen-6): "How would you like to pay?" (Bank transfer, Pay by Card, Interswitch / Hosted page).
 * 5. Transfer Details Loader (SenderScreen-7): "Getting your transfer details...".
 * 6. Bank Transfer Instructions (SenderScreen-8): Skips "Which account will you pay from?" and goes straight to
 *    "SEND EXACT AMOUNT USING REFERENCE" with the payer's source bank account box expanded at the top (with the
 *    manual-matching advisory note and optional "Change" link -> SenderScreen-Add-bank-account), Copy buttons,
 *    and solid blue "I've sent the money".
 */

import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  LifeBuoy,
  Loader2,
  Lock,
  ShieldCheck,
  Clock,
  CreditCard,
  Building2,
  RefreshCw,
  Info,
  Check,
  AlertCircle,
  Copy,
  ChevronLeft,
  X,
  Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// @ts-ignore
import logo from "../assets/rhemito-logo-blue.png";
import {
  getPublicRequest,
  startPayerSession,
  sendPayerVerificationPin,
  verifyPayerVerificationPin,
  continueFromEmailLink,
  savePayerBankAccount,
  createIntent,
  devAuthorizeIntent,
  requestNewLink,
  METHOD_LABELS,
  type PublicRequestView,
  type PayerSavedBankAccount,
  type Quote,
} from "@/lib/requests";
import { genderOptions } from "@/data/countries";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY_SYMBOLS } from "@shared/currencies";
import { formatHumanDate } from "@shared/invoice-logic";

type FlowStep = "pre_auth" | "session_active" | "session_expired" | "authorizing" | "status";
type VerifyStage = "email_only" | "code_sent" | "email_link_profile";
type PaymentSubStep =
  | "qr_handoff"
  | "method_select"
  | "loading_transfer"
  | "bank_transfer_details"
  | "add_bank_account";

const PAYER_BANKS = [
  "Paga Mobile Money",
  "Access Bank Nigeria Plc",
  "Guaranty Trust Bank (GTBank)",
  "First Bank of Nigeria",
  "Zenith Bank",
  "United Bank for Africa (UBA)",
  "Fidelity Bank",
  "First City Monument Bank (FCMB)",
  "Union Bank of Nigeria",
  "Wema Bank",
  "Moniepoint Microfinance Bank",
  "OPay Digital Services",
  "Kuda Bank",
  "Sterling Bank",
  "Stanbic IBTC Bank",
  "Barclays",
  "HSBC UK",
  "Lloyds Bank",
  "NatWest",
  "Monzo Bank",
  "Revolut",
];

export default function RequestCheckout() {
  const params = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const token = params.id;
  const isEmailLink = location.startsWith("/pay/e/");

  const { user: authUser } = useAuth();

  // Main Flow Step State
  const [step, setStep] = useState<FlowStep>("pre_auth");
  const [started, setStarted] = useState(false);

  // Email & Code Verification State (SenderScreen-2, 3, 4)
  const [verifyStage, setVerifyStage] = useState<VerifyStage>("email_only");
  const [payerEmail, setPayerEmail] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [pinSent, setPinSent] = useState(false);
  const [pinCooldown, setPinCooldown] = useState(0);
  const [devPin, setDevPin] = useState("");
  const [showCodeBanner, setShowCodeBanner] = useState(true);
  const [isKnownEmailSender, setIsKnownEmailSender] = useState(false);

  // Conditional "New to Mito?" Mini-KYC State (only shown when email is NOT already registered/known)
  const [regAccountType, setRegAccountType] = useState<"individual" | "business">("individual");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regGender, setRegGender] = useState("");
  const [bizName, setBizName] = useState("");

  // Session & Active Payment Flow State (SenderScreen-5, 6, 7, 8, Add-bank-account)
  const [paymentSubStep, setPaymentSubStep] = useState<PaymentSubStep>("qr_handoff");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(1800);
  const [, setActiveQuote] = useState<Quote | null>(null);
  const [payerDisplayName, setPayerDisplayName] = useState<string>("");

  // Payer Source Bank Account State (SenderScreen-8 & SenderScreen-Add-bank-account)
  const [savedAccounts, setSavedAccounts] = useState<PayerSavedBankAccount[]>([]);
  const [selectedPayerBankAccount, setSelectedPayerBankAccount] = useState<PayerSavedBankAccount | null>(null);
  const [newBankName, setNewBankName] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [resolvedAccountName, setResolvedAccountName] = useState("");
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [saveAccountForNextTime, setSaveAccountForNextTime] = useState(true);

  // Payment Method & Execution State
  const [selectedMethod, setSelectedMethod] = useState<string>("bank_transfer");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);

  // Renewal State
  const [renewalRequested, setRenewalRequested] = useState(false);
  const [renewalMessage, setRenewalMessage] = useState("");

  // Success Auto-Redirect Timer (60 seconds)
  const [redirectCountdown, setRedirectCountdown] = useState<number>(60);

  // Query Public Request Details
  const {
    data: request,
    isError,
    refetch,
    isLoading: isRequestLoading,
  } = useQuery<PublicRequestView>({
    queryKey: [`/api/public/requests/${isEmailLink ? "e/" : ""}${token}`],
    queryFn: () => getPublicRequest(token!, isEmailLink),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return ["authorisation_in_progress", "payment_processing", "payment_pending", "funded", "payout_pending"].includes(s ?? "") ? 1500 : false;
    },
    retry: false,
  });

  // Pre-populate email & known bank accounts when request loads
  useEffect(() => {
    if (!request) return;
    if (isEmailLink && (request.demoPayerEmail || authUser?.email)) {
      setPayerEmail(request.demoPayerEmail || authUser?.email || "");
    }
    if (request.senderName) {
      const parts = request.senderName.trim().split(/\s+/);
      if (!regFirstName && parts[0]) setRegFirstName(parts[0]);
      if (!regLastName && parts.length > 1) setRegLastName(parts.slice(1).join(" "));
      if (!bizName && request.senderType === "business") setBizName(request.senderName);
    }
    if (request.payerSavedAccounts && request.payerSavedAccounts.length > 0 && savedAccounts.length === 0) {
      setSavedAccounts(request.payerSavedAccounts);
      setSelectedPayerBankAccount(request.payerSavedAccounts[0]);
    } else if (request.payerSourceBankName && (request.payerSourceAccountNumber || request.payerSourceAccountMasked) && !selectedPayerBankAccount) {
      const initialAcc: PayerSavedBankAccount = {
        id: "req_source_acc",
        bankName: request.payerSourceBankName,
        accountNumber: request.payerSourceAccountNumber || request.payerSourceAccountMasked || "",
        accountName: request.senderName || "Verified Sender",
      };
      setSavedAccounts([initialAcc]);
      setSelectedPayerBankAccount(initialAcc);
    }
  }, [request, isEmailLink, authUser]);

  // Resolve account name when adding a new bank account (SenderScreen-Add-bank-account)
  useEffect(() => {
    const cleanDigits = newAccountNumber.replace(/\D/g, "");
    if (!newBankName || cleanDigits.length < 6) {
      setResolvedAccountName("");
      return;
    }
    let cancelled = false;
    setResolvingAccount(true);
    const timer = setTimeout(() => {
      if (cancelled) return;
      const fallbackName =
        payerDisplayName
        || [regFirstName, regLastName].filter(Boolean).join(" ")
        || request?.senderName
        || "Firopo Akintayo Akin-Agunbiade";
      setResolvedAccountName(fallbackName);
      setResolvingAccount(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [newBankName, newAccountNumber, payerDisplayName, regFirstName, regLastName, request?.senderName]);

  // Handle session timer countdown
  useEffect(() => {
    if (!sessionExpiresAt || step !== "session_active") return;
    const interval = setInterval(() => {
      const diffMs = sessionExpiresAt.getTime() - Date.now();
      const seconds = Math.max(0, Math.floor(diffMs / 1000));
      setSessionSecondsLeft(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        setRedirectCountdown(60);
        setStep("session_expired");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt, step]);

  // Handle PIN cooldown timer
  useEffect(() => {
    if (pinCooldown <= 0) return;
    const timer = setInterval(() => setPinCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [pinCooldown]);

  // Status synchronization
  useEffect(() => {
    if (!request) return;
    if (request.status === "funded" || request.status === "payout_pending" || request.status === "paid_out") {
      setStep("status");
    }
  }, [request?.status]);

  // Auto-redirect timer on success
  useEffect(() => {
    const shouldRedirect =
      (request?.status === "paid_out" && step === "status")
      || ["authorisation_in_progress", "payment_processing", "payment_pending"].includes(request?.status ?? "")
      || step === "session_expired";
    if (!shouldRedirect) return;
    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [request?.status, step, setLocation]);

  if (isError) {
    return (
      <Shell>
        <StatusCard icon={<Lock className="w-8 h-8 text-slate-600" />} title="Payment Link Invalid" testId="invalid-link">
          <p className="text-sm text-slate-700">This payment link does not exist, has expired, or has already been used.</p>
          <p className="text-xs text-muted-foreground mt-2">If you believe this is an error, please contact the requester or Rhemito Support.</p>
          <Button variant="outline" className="w-full mt-4" onClick={() => setLocation("/")}>
            Go to Rhemito Home
          </Button>
        </StatusCard>
      </Shell>
    );
  }

  if (isRequestLoading || !request) {
    return (
      <Shell>
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500 text-sm">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Loading secure payment checkout…</span>
        </div>
      </Shell>
    );
  }

  const symbol = CURRENCY_SYMBOLS[request.currency] ?? "";
  const terminalPaid = request.status === "paid_out" || request.status === "funded" || request.status === "payout_pending";
  const isExpired = request.status === "expired";
  const isCancelled = request.status === "cancelled";
  const isProcessing = ["authorisation_in_progress", "payment_processing", "payment_pending"].includes(request.status);

  const copyValue = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField((prev) => (prev === key ? null : prev)), 1800);
      toast({ title: `${label} copied`, description: value });
    } catch {
      toast({ title: label, description: value });
    }
  };

  // ─── SESSION & AUTHENTICATION HANDLERS ──────────────────────────────────────

  const applySavedAccounts = (accounts?: PayerSavedBankAccount[], fallbackName?: string) => {
    if (accounts && accounts.length > 0) {
      setSavedAccounts(accounts);
      setSelectedPayerBankAccount((prev) => prev ?? accounts[0]);
      return;
    }
    if (request.payerSourceBankName && (request.payerSourceAccountNumber || request.payerSourceAccountMasked)) {
      const acc: PayerSavedBankAccount = {
        id: "req_acc",
        bankName: request.payerSourceBankName,
        accountNumber: request.payerSourceAccountNumber || request.payerSourceAccountMasked || "",
        accountName: fallbackName || request.senderName || "Verified Sender",
      };
      setSavedAccounts([acc]);
      setSelectedPayerBankAccount((prev) => prev ?? acc);
    }
  };

  const handleStartPayerFlow = async (accountsFromVerify?: PayerSavedBankAccount[], verifiedName?: string) => {
    setBusy(true);
    setErrorMessage("");
    setComplianceNotice(null);
    try {
      const session = await startPayerSession({
        token: token!,
        isEmailLink,
      });

      setActiveSessionId(session.sessionId);
      setSessionExpiresAt(new Date(session.sessionExpiresAt));
      setActiveQuote(session.quote);
      const finalName = verifiedName || session.payerName || request.senderName || payerEmail;
      setPayerDisplayName(finalName);
      applySavedAccounts(accountsFromVerify, finalName);
      await refetch();
      const isMobileViewport = typeof window !== "undefined" && window.innerWidth < 640;
      setPaymentSubStep(isMobileViewport ? "method_select" : "qr_handoff");
      setStep("session_active");
    } catch (err: any) {
      if (err?.code === "KYC_PENDING") {
        setComplianceNotice(
          "Your identity verification is currently being reviewed by our compliance team. A secure link has been saved to your account to complete payment once approved.",
        );
      } else if (err?.code === "KYC_FAILED" || err?.code === "BLOCKED") {
        setErrorMessage("Your account cannot complete this payment due to compliance restrictions. Please contact support.");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Failed to start payment session. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Clicking "Pay now" on the initial summary card (SenderScreen-1):
   * - If the payer opened the emailed link (/pay/e/:token), their email was
   *   already verified by clicking the link in their inbox (no 6-digit code needed).
   *   - If their name/profile is already known -> proceed directly to payment!
   *   - If they are a brand-new sender -> show only the "New to Mito?" fields (no OTP).
   * - If the payer opened a copied link (/pay/:token), show "Verify Your Email To Continue"
   *   with ONLY the Email input + "Send code" button initially.
   */
  const handlePayNowClick = async () => {
    setErrorMessage("");
    if (isEmailLink) {
      const emailToUse = (payerEmail || request.demoPayerEmail || "").trim().toLowerCase();
      if (emailToUse) setPayerEmail(emailToUse);
      if (request.isKnownSender && emailToUse) {
        setBusy(true);
        try {
          const res = await continueFromEmailLink(token!, { email: emailToUse });
          await handleStartPayerFlow(res.savedAccounts, res.payerName);
          return;
        } catch (err: any) {
          setErrorMessage(err?.message || "Could not start payment session.");
          setBusy(false);
        }
      }
      setVerifyStage("email_link_profile");
      setStarted(true);
      return;
    }
    setVerifyStage("email_only");
    setStarted(true);
  };

  /**
   * Step 1 on Copied Link (/pay/:token): Payer enters their email and clicks "Send code".
   * Sends the 6-digit confirmation code without ever asking for a password.
   * Only reveals "New to Mito?" fields on the next view if the email is NOT already a known sender.
   */
  const handleSendCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = payerEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await sendPayerVerificationPin(token!, email, isEmailLink, true);
      setPinSent(true);
      setPinCooldown(result.resendAfterSeconds);
      setDevPin(result.devPin ?? "");
      setIsKnownEmailSender(Boolean(result.isKnownSender));
      if (result.senderName && !payerDisplayName) {
        setPayerDisplayName(result.senderName);
      }
      if (result.savedAccounts && result.savedAccounts.length > 0) {
        setSavedAccounts(result.savedAccounts);
        setSelectedPayerBankAccount(result.savedAccounts[0]);
      }
      setShowCodeBanner(true);
      setVerifyStage("code_sent");
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not send confirmation code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleResendCode = async () => {
    const email = payerEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await sendPayerVerificationPin(token!, email, isEmailLink, true);
      setPinSent(true);
      setPinCooldown(result.resendAfterSeconds);
      setDevPin(result.devPin ?? "");
      setShowCodeBanner(true);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to resend code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Step 2 on Copied Link (/pay/:token): Payer enters 6-digit confirmation code
   * (plus "New to Mito?" fields ONLY if their email is new) and clicks "Verify and pay".
   */
  const handleVerifyCodeAndPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode || pinCode.length !== 6) {
      setErrorMessage("Please enter the 6-digit confirmation code.");
      return;
    }
    if (!isKnownEmailSender) {
      if (regAccountType === "individual") {
        if (!regFirstName.trim() || !regLastName.trim()) {
          setErrorMessage("Please enter your first name and last name.");
          return;
        }
        if (!regGender) {
          setErrorMessage("Please select your gender.");
          return;
        }
      } else {
        if (!bizName.trim()) {
          setErrorMessage("Please enter your business name.");
          return;
        }
      }
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const email = payerEmail.trim().toLowerCase();
      const verified = await verifyPayerVerificationPin(token!, email, pinCode, isEmailLink, {
        authenticatePayer: true,
        accountType: regAccountType,
        firstName: regFirstName.trim() || undefined,
        lastName: regLastName.trim() || undefined,
        businessName: bizName.trim() || undefined,
        gender: regGender || undefined,
      });
      await handleStartPayerFlow(verified.savedAccounts, verified.payerName);
    } catch (err: any) {
      setErrorMessage(err?.message || "The confirmation code could not be verified.");
      setBusy(false);
    }
  };

  /**
   * Email Link (/pay/e/:token) when sender is brand new: no 6-digit code required,
   * only collects "New to Mito?" details and continues to payment.
   */
  const handleEmailLinkProfileContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = payerEmail.trim().toLowerCase();
    if (!email) {
      setErrorMessage("Please confirm your email address.");
      return;
    }
    if (!isKnownEmailSender && !request.isKnownSender) {
      if (regAccountType === "individual") {
        if (!regFirstName.trim() || !regLastName.trim()) {
          setErrorMessage("Please enter your first name and last name.");
          return;
        }
        if (!regGender) {
          setErrorMessage("Please select your gender.");
          return;
        }
      } else if (!bizName.trim()) {
        setErrorMessage("Please enter your business name.");
        return;
      }
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const res = await continueFromEmailLink(token!, {
        email,
        accountType: regAccountType,
        firstName: regFirstName.trim() || undefined,
        lastName: regLastName.trim() || undefined,
        businessName: bizName.trim() || undefined,
        gender: regGender || undefined,
      });
      await handleStartPayerFlow(res.savedAccounts, res.payerName);
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not continue to payment.");
      setBusy(false);
    }
  };

  // ─── PAYMENT METHOD & BANK TRANSFER EXECUTION ─────────────────────────────

  /**
   * Clicking "Continue" on "How would you like to pay?" (SenderScreen-6):
   * - If "bank_transfer" is selected: shows "Getting your transfer details..." (SenderScreen-7)
   *   and goes straight to the Bank Transfer Instructions screen (SenderScreen-8),
   *   skipping "Which account will you pay from?".
   * - If "card" or "interswitch" is selected: initiates the card/hosted authorisation flow.
   */
  const handleContinueFromMethodSelect = async () => {
    setErrorMessage("");
    if (selectedMethod === "bank_transfer") {
      setPaymentSubStep("loading_transfer");
      setTimeout(() => {
        setPaymentSubStep("bank_transfer_details");
      }, 450);
      return;
    }

    // Card or Interswitch / Hosted checkout
    setBusy(true);
    try {
      if (!activeSessionId) throw new Error("Start a new payment session to continue.");
      const backendMethod = selectedMethod === "interswitch" ? "card" : selectedMethod;
      const intent = await createIntent(token!, backendMethod, activeSessionId, isEmailLink);
      setIntentId(intent.intentId);
      setPaymentReference(intent.paymentReference);
      setStep("authorizing");
      await refetch();
    } catch (err: any) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to initiate payment.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Clicking "I've sent the money" on Bank Transfer Instructions (SenderScreen-8).
   */
  const handleIveSentTheMoney = async () => {
    if (busy) return;
    setBusy(true);
    setErrorMessage("");
    try {
      let currentIntentId = intentId;
      if (!currentIntentId) {
        if (!activeSessionId) throw new Error("Start a new payment session to continue.");
        const available = request.methods.length > 0 ? request.methods : (request.availableMethods ?? ["bank_transfer"]);
        const methodToUse = available.includes("bank_transfer") ? "bank_transfer" : available[0];
        const intent = await createIntent(token!, methodToUse, activeSessionId, isEmailLink);
        currentIntentId = intent.intentId;
        setIntentId(intent.intentId);
        setPaymentReference(intent.paymentReference);
      }
      await devAuthorizeIntent(currentIntentId!);
      setStep("status");
      await refetch();
    } catch (err: any) {
      setErrorMessage(err instanceof Error ? err.message : "Could not confirm transfer. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Saving a new/changed payer bank account on "Add the account you'll pay from" (SenderScreen-Add-bank-account).
   */
  const handleSaveNewBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = newAccountNumber.replace(/\D/g, "");
    if (!newBankName) {
      setErrorMessage("Please choose your bank.");
      return;
    }
    if (digits.length < 6) {
      setErrorMessage("Please enter a valid account number.");
      return;
    }
    const holder =
      resolvedAccountName
      || payerDisplayName
      || [regFirstName, regLastName].filter(Boolean).join(" ")
      || request.senderName
      || "Firopo Akintayo Akin-Agunbiade";

    setBusy(true);
    setErrorMessage("");
    try {
      const res = await savePayerBankAccount({
        token: token!,
        isEmailLink,
        bankName: newBankName,
        accountNumber: digits,
        accountName: holder,
        email: payerEmail || request.demoPayerEmail,
        saveToProfile: saveAccountForNextTime,
      });
      setSelectedPayerBankAccount(res.account);
      if (res.savedAccounts?.length) {
        setSavedAccounts(res.savedAccounts);
      }
      setNewBankName("");
      setNewAccountNumber("");
      setPaymentSubStep("bank_transfer_details");
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not save bank account.");
    } finally {
      setBusy(false);
    }
  };

  const handleAuthorizeSimulate = async () => {
    if (!intentId || busy) return;
    setBusy(true);
    setErrorMessage("");
    try {
      await devAuthorizeIntent(intentId);
      setStep("status");
      await refetch();
    } catch (err: any) {
      setErrorMessage(err instanceof Error ? err.message : "Authorisation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestNewPaymentLink = async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      const res = await requestNewLink(token!, isEmailLink, payerEmail || undefined);
      setRenewalRequested(true);
      setRenewalMessage(res.message || "Notification sent to requester.");
    } catch (err: any) {
      setErrorMessage(err.message || "Could not submit renewal request.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPayment = () => {
    setStarted(false);
    setStep("pre_auth");
    setPaymentSubStep("qr_handoff");
    setErrorMessage("");
  };

  // ─── 1. STATUS & RESULT PAGES ──────────────────────────────────────────────

  if (step === "session_expired") {
    return (
      <Shell>
        <StatusCard icon={<Clock className="w-8 h-8 text-amber-600" />} title="Payment Session Expired" testId="session-expired-card">
          <p className="text-sm text-slate-700">No payment was submitted. Start a new session if this request is still available.</p>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleStartPayerFlow()} disabled={busy} data-testid="button-start-new-session">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Start New Payment Session
          </Button>
          <p className="text-xs text-center text-muted-foreground">Returning home in {redirectCountdown}s.</p>
          <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>Go to Home Page Now</Button>
        </StatusCard>
      </Shell>
    );
  }

  if (step === "status" || terminalPaid || isExpired || isCancelled || (isProcessing && step !== "authorizing")) {
    if (isExpired) {
      return (
        <Shell>
          <StatusCard
            icon={<Clock className="w-8 h-8 text-amber-600" />}
            title="Payment Request Expired"
            testId="expired-card"
          >
            <p className="text-sm text-slate-700">
              This payment request expired on <strong>{formatHumanDate(request.expiryDate)}</strong>. Payments can no longer be accepted on this link.
            </p>
            {renewalRequested ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium space-y-1">
                <p className="flex items-center gap-1.5 font-semibold text-emerald-800">
                  <Check className="w-4 h-4 text-emerald-600" /> New Link Requested
                </p>
                <p>{renewalMessage}</p>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleRequestNewPaymentLink}
                  disabled={busy}
                  data-testid="button-request-new-link"
                >
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Request a New Payment Link
                </Button>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
              Back to Home
            </Button>
          </StatusCard>
        </Shell>
      );
    }

    if (isCancelled) {
      return (
        <Shell>
          <StatusCard
            icon={<AlertCircle className="w-8 h-8 text-slate-500" />}
            title="Request Cancelled"
            testId="cancelled-card"
          >
            <p className="text-sm text-slate-700">
              This request was cancelled by the requester (<strong>{request.requesterName}</strong>).
            </p>
            <Button variant="outline" className="w-full mt-4" onClick={() => setLocation("/")}>
              Back to Home
            </Button>
          </StatusCard>
        </Shell>
      );
    }

    if (request.status === "paid_out") {
      return (
        <Shell>
          <StatusCard
            icon={<CheckCircle2 className="w-9 h-9 text-emerald-600" />}
            title="Payment Successful!"
            testId="success-card"
          >
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 text-center space-y-1">
              <p className="text-xs uppercase tracking-wider text-emerald-800 font-semibold">Total Paid</p>
              <p className="text-3xl font-extrabold text-emerald-950 font-display">
                {symbol}{request.amount} <span className="text-sm font-normal text-emerald-800">{request.currency}</span>
              </p>
            </div>

            <div className="rounded-xl border border-border divide-y divide-border text-xs">
              <Row label="Payment Reference" value={<span className="font-mono">{paymentReference || request.collectionAccount?.paymentReference || `PAY-${request.requestNumber}`}</span>} />
              <Row label="Request Number" value={request.requestNumber} />
              <Row label="Paid to" value={request.requesterName} />
              {request.purpose && <Row label="Purpose" value={request.purpose.replace(/_/g, " ")} />}
              {request.reference && <Row label="Reference Note" value={request.reference} />}
              <Row label="Date & Time" value={new Date().toLocaleString()} />
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-center text-xs text-muted-foreground border border-slate-200">
              <p>Redirecting to home in <strong className="text-blue-600">{redirectCountdown}s</strong>…</p>
            </div>

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setLocation("/")}
              data-testid="button-go-home-now"
            >
              Go to Dashboard Now
            </Button>
          </StatusCard>
        </Shell>
      );
    }

    if (step === "status" && request.failureReason && ["active", "viewed"].includes(request.status)) {
      return (
        <Shell>
          <StatusCard icon={<AlertCircle className="w-8 h-8 text-red-600" />} title="Payment Was Not Completed" testId="failed-card">
            <p className="text-sm text-slate-700">Your payment was not completed. No successful payment was recorded.</p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleStartPayerFlow()} disabled={busy} data-testid="button-try-again">Try Again</Button>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>Go to Home Page</Button>
          </StatusCard>
        </Shell>
      );
    }

    return (
      <Shell>
        <StatusCard
          icon={<Loader2 className="w-8 h-8 animate-spin text-blue-600" />}
          title="Payment Processing…"
          testId="pending-card"
        >
          <p className="text-sm text-slate-700 text-center">Your transfer has been submitted and is being processed. You will receive a receipt by email once confirmed.</p>
          <div className="rounded-xl border border-border divide-y divide-border text-xs">
            <Row label="Request" value={request.requestNumber} />
            <Row label="Amount" value={`${symbol}${request.amount} ${request.currency}`} />
            <Row label="Status" value="Payment Processing" />
          </div>
          <p className="text-xs text-center text-muted-foreground">Returning home in {redirectCountdown}s. This page updates automatically.</p>
          <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>Go to Home Page Now</Button>
        </StatusCard>
      </Shell>
    );
  }

  // ─── 2. CARD / HOSTED PROVIDER AUTHORISATION ──────────────────────────────

  if (step === "authorizing" && intentId) {
    return (
      <Shell>
        <StatusCard
          icon={<ShieldCheck className="w-8 h-8 text-blue-600" />}
          title={selectedMethod === "interswitch" ? "Interswitch Hosted Checkout" : "Authorise Your Card Payment"}
          testId="authorize-card"
        >
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Reference:</span>
              <span className="font-mono font-semibold text-slate-900">{paymentReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-bold text-slate-900">{symbol}{request.amount} {request.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method:</span>
              <span className="font-medium text-slate-800">
                {selectedMethod === "interswitch" ? "Interswitch / Hosted page" : (METHOD_LABELS[selectedMethod ?? ""] ?? selectedMethod)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payee:</span>
              <span className="font-medium text-slate-800">{request.requesterName}</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1" data-testid="dev-provider-notice">
            <p className="font-semibold flex items-center gap-1">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              Development Provider Simulation
            </p>
            <p className="text-[11px] leading-relaxed">
              In production, this step opens the {selectedMethod === "interswitch" ? "Interswitch Webpay hosted page" : "3-D Secure card authorisation screen"}. Clicking below simulates successful provider authorisation and triggers signed webhook settlement.
            </p>
          </div>

          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                setStep("session_active");
                setPaymentSubStep("method_select");
                setIntentId(null);
              }}
            >
              Back
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={busy}
              onClick={handleAuthorizeSimulate}
              data-testid="button-authorize"
            >
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Authorising…</> : "Authorise Payment"}
            </Button>
          </div>
        </StatusCard>
      </Shell>
    );
  }

  // ─── 3. ACTIVE RHEMITO PAYMENT FLOW (SenderScreen-5, 6, 7, 8, Add-bank) ────

  if (step === "session_active") {
    const exactAmountText = `${request.currency} ${formatMoney(request.amount)}`;
    const collectionAccountName = request.collectionAccount?.accountName || `PWA - MITO-${request.requesterName.toUpperCase()}`;
    const collectionBankName = request.collectionAccount?.bankName || (request.currency === "NGN" ? "Fidelity" : "ClearBank");
    const collectionAccountNumber = request.collectionAccount?.accountNumber || "4580016814";
    const collectionReference = request.collectionAccount?.paymentReference || paymentReference || "24588534";
    const checkoutQrUrl = typeof window !== "undefined" ? window.location.href : "";

    return (
      <Shell>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="shadow-xl overflow-hidden border-2 border-blue-600 bg-white rounded-2xl" data-testid="mito-payment-card">
            {/* RHEMITO PAYMENT Header (matches SenderScreen-5, 6, 7, 8) */}
            <div className="relative px-6 pt-6 pb-4 text-center border-b border-slate-100" data-testid="checkout-summary">
              <button
                type="button"
                onClick={handleCancelPayment}
                className="absolute right-4 top-4 p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                aria-label="Close payment"
                data-testid="button-close-payment"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center gap-1.5">
                <RhemitoRibbonMark className="w-8 h-9 text-blue-600" />
                <p className="text-[11px] font-bold tracking-[0.2em] text-blue-600 uppercase">Rhemito Payment</p>
              </div>

              <div className="mt-3">
                <p className="text-base font-bold text-slate-800 leading-snug">Payment Request From</p>
                <p className="text-lg font-extrabold text-slate-900 uppercase tracking-tight" data-testid="checkout-requester-name">
                  {request.requesterName}
                </p>
              </div>
            </div>

            <CardContent className="p-6 space-y-5">
              {/* ── SUB-STEP A: Continue on your phone (SenderScreen-5) ── */}
              {paymentSubStep === "qr_handoff" && (
                <div className="space-y-5 text-center" data-testid="screen-continue-on-phone">
                  <div className="space-y-2">
                    <h2 className="text-xl font-extrabold text-slate-900">Continue on your phone</h2>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Scan this with your camera to finish paying — it's the quickest way to confirm a bank transfer or open your banking app.
                    </p>
                  </div>

                  {/* QR Code with centered blue 'r' badge */}
                  <div className="flex justify-center py-1">
                    <div className="relative inline-flex items-center justify-center p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&ecc=M&data=${encodeURIComponent(checkoutQrUrl)}`}
                        alt="Scan QR code to continue on your phone"
                        className="w-44 h-44 object-contain"
                        data-testid="img-handoff-qr"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold text-lg flex items-center justify-center shadow-md border-2 border-white">
                          r
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-px bg-slate-200 flex-1" />
                    <span className="text-xs text-slate-400 font-medium">or</span>
                    <div className="h-px bg-slate-200 flex-1" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-xl border-slate-200 text-slate-900 font-bold hover:bg-slate-50"
                    onClick={() => setPaymentSubStep("method_select")}
                    data-testid="button-continue-browser"
                  >
                    Continue on this browser instead
                  </Button>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    This screen only appears on desktop — the mobile site continues automatically.
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleCancelPayment}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                      data-testid="button-cancel-payment"
                    >
                      Cancel Payment
                    </button>
                  </div>
                </div>
              )}

              {/* ── SUB-STEP B: How would you like to pay? (SenderScreen-6) ── */}
              {paymentSubStep === "method_select" && (
                <div className="space-y-5" data-testid="screen-method-select">
                  {/* Back button + Progress bar */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentSubStep("qr_handoff")}
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0"
                      aria-label="Back"
                      data-testid="button-back-to-qr"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full w-5/12 bg-blue-600 rounded-full" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-slate-900">How would you like to pay?</h2>
                    <p className="text-sm text-slate-500">Choose a method, then continue.</p>
                  </div>

                  {/* Payment Methods: Bank transfer, Pay by Card, Interswitch / Hosted page */}
                  <div className="space-y-2.5" role="radiogroup" aria-label="How would you like to pay?">
                    {[
                      {
                        id: "bank_transfer",
                        title: "Bank transfer",
                        badge: "No card fees",
                        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
                        subtitle: request.currency === "NGN" ? "Instant Nigerian bank transfer" : "Instant bank transfer",
                        icon: <Building2 className="w-4 h-4 text-slate-700" />,
                      },
                      {
                        id: "card",
                        title: "Pay by Card",
                        badge: "Instant",
                        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
                        subtitle: "Debit or credit card (Visa / Mastercard)",
                        icon: <CreditCard className="w-4 h-4 text-slate-700" />,
                      },
                      {
                        id: "interswitch",
                        title: "Interswitch / Hosted page",
                        badge: "Hosted",
                        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
                        subtitle: "Pay securely via Interswitch hosted checkout",
                        icon: <Globe className="w-4 h-4 text-slate-700" />,
                      },
                    ].map((m) => {
                      const active = selectedMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={busy}
                          onClick={() => setSelectedMethod(m.id)}
                          className={`w-full flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-all ${
                            active
                              ? "border-blue-600 bg-blue-50/50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-blue-300"
                          }`}
                          data-testid={`button-method-${m.id}`}
                        >
                          <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                            {m.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-bold text-slate-900">{m.title}</span>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${m.badgeClass}`}>
                                {m.badge}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{m.subtitle}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Total to pay */}
                  <div className="rounded-2xl border border-slate-200 px-4 py-3.5 flex items-center justify-between bg-white">
                    <span className="text-sm text-slate-500 font-medium">Total to pay</span>
                    <span className="text-lg font-extrabold text-slate-900 tabular-nums" data-testid="method-total-to-pay">
                      {exactAmountText}
                    </span>
                  </div>

                  {errorMessage && <p className="text-xs text-destructive" data-testid="error-checkout">{errorMessage}</p>}

                  <Button
                    type="button"
                    className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-sm"
                    disabled={busy}
                    onClick={handleContinueFromMethodSelect}
                    data-testid="button-pay-now"
                  >
                    {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</> : "Continue"}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleCancelPayment}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                      data-testid="button-cancel-method"
                    >
                      Cancel Payment
                    </button>
                  </div>
                </div>
              )}

              {/* ── SUB-STEP C: Getting your transfer details... (SenderScreen-7) ── */}
              {paymentSubStep === "loading_transfer" && (
                <div className="space-y-6 py-4 text-center" data-testid="screen-loading-transfer">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentSubStep("method_select")}
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0"
                      aria-label="Back"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full w-9/12 bg-blue-600 rounded-full" />
                    </div>
                  </div>

                  <div className="py-8 flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    <p className="text-sm font-medium text-slate-500">Getting your transfer details...</p>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleCancelPayment}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Cancel Payment
                    </button>
                  </div>
                </div>
              )}

              {/* ── SUB-STEP D: Bank Transfer Instructions (SenderScreen-8) ── */}
              {paymentSubStep === "bank_transfer_details" && (
                <div className="space-y-4" data-testid="screen-bank-transfer-details">
                  {/* Back button + Progress bar */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentSubStep("method_select")}
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0"
                      aria-label="Back"
                      data-testid="button-back-to-methods"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full w-10/12 bg-blue-600 rounded-full" />
                    </div>
                  </div>

                  {/* Top Payer Source Account Box — open by default with updated manual-matching advisory */}
                  <div
                    className="rounded-2xl border-2 border-blue-600 bg-blue-50/40 p-4 space-y-2.5"
                    data-testid="payer-source-account-box"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-xl bg-white border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1 text-xs leading-snug">
                        <p className="font-semibold text-slate-900 text-[13px]">
                          1. Pay by Bank Transfer from your account{" "}
                          {selectedPayerBankAccount ? (
                            <span className="font-extrabold">
                              {selectedPayerBankAccount.accountNumber} · {selectedPayerBankAccount.accountName}
                            </span>
                          ) : (
                            <span className="font-extrabold">{payerDisplayName || payerEmail}</span>
                          )}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {selectedPayerBankAccount ? selectedPayerBankAccount.bankName : "Your bank account"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="w-6 h-6 rounded-full bg-white border border-blue-200 flex items-center justify-center text-blue-600">
                          <Info className="w-3.5 h-3.5" />
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMessage("");
                            setPaymentSubStep("add_bank_account");
                          }}
                          className="text-xs font-bold text-blue-600 hover:underline"
                          data-testid="button-change-payer-account"
                        >
                          Change
                        </button>
                      </div>
                    </div>

                    {/* Open-by-default manual-matching advisory requested in the video */}
                    <p
                      className="text-xs text-amber-800 bg-amber-50/90 border border-amber-200/80 rounded-xl px-3 py-2 font-medium leading-relaxed"
                      data-testid="payer-account-advisory"
                    >
                      Please send only from this account. If you send from a separate account, we may not be able to match it instantly and your recipient may have to match it manually.
                    </p>
                  </div>

                  {/* SEND EXACT AMOUNT USING REFERENCE */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      Send Exact Amount Using Reference
                    </p>

                    <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-xs">
                      {[
                        { key: "amount", label: "Exact amount", value: exactAmountText },
                        { key: "accountName", label: "Account name", value: collectionAccountName },
                        { key: "bankName", label: "Bank name", value: collectionBankName },
                        { key: "accountNumber", label: "Account number", value: collectionAccountNumber },
                        { key: "reference", label: "Payment reference", value: collectionReference },
                      ].map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-xs text-slate-400">{row.label}</p>
                            <p
                              className="text-sm font-extrabold text-slate-900 break-all"
                              data-testid={`transfer-detail-${row.key}`}
                            >
                              {row.value}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void copyValue(row.key, row.value, row.label)}
                            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 transition-colors"
                            aria-label={`Copy ${row.label}`}
                            data-testid={`button-copy-${row.key}`}
                          >
                            {copiedField === row.key ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {errorMessage && <p className="text-xs text-destructive" data-testid="error-transfer">{errorMessage}</p>}

                  <Button
                    type="button"
                    className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-sm"
                    disabled={busy}
                    onClick={handleIveSentTheMoney}
                    data-testid="button-ive-sent-money"
                  >
                    {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming transfer…</> : "I've sent the money"}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleCancelPayment}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                      data-testid="button-cancel-transfer"
                    >
                      Cancel Payment
                    </button>
                  </div>
                </div>
              )}

              {/* ── SUB-STEP E: Add the account you'll pay from (SenderScreen-Add-bank-account) ── */}
              {paymentSubStep === "add_bank_account" && (
                <form onSubmit={handleSaveNewBankAccount} className="space-y-4" data-testid="screen-add-bank-account">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentSubStep("bank_transfer_details")}
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0"
                      aria-label="Back to transfer details"
                      data-testid="button-back-from-add-bank"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full w-9/12 bg-blue-600 rounded-full" />
                    </div>
                  </div>

                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-slate-900">Add the account you'll pay from</h2>
                    <p className="text-xs text-slate-500">We use it to match your transfer to this request.</p>
                  </div>

                  {savedAccounts.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Saved accounts</Label>
                      <div className="space-y-1.5">
                        {savedAccounts.map((acc) => {
                          const isCurrent = selectedPayerBankAccount?.id === acc.id;
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setSelectedPayerBankAccount(acc);
                                setPaymentSubStep("bank_transfer_details");
                              }}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-colors ${
                                isCurrent ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-blue-300"
                              }`}
                              data-testid={`button-saved-payer-account-${acc.id}`}
                            >
                              <div>
                                <p className="font-bold text-slate-900">{acc.bankName} · {acc.accountNumber}</p>
                                <p className="text-slate-500">{acc.accountName}</p>
                              </div>
                              <span className="text-blue-600 font-semibold">Use</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Bank</Label>
                    <Select value={newBankName} onValueChange={setNewBankName}>
                      <SelectTrigger className="h-12 rounded-xl bg-white" data-testid="select-payer-bank">
                        <SelectValue placeholder="Choose your bank" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {PAYER_BANKS.map((bank) => (
                          <SelectItem key={bank} value={bank}>
                            {bank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="newAccountNumber" className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      Account Number
                    </Label>
                    <Input
                      id="newAccountNumber"
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="10-digit account number"
                      value={newAccountNumber}
                      onChange={(e) => setNewAccountNumber(e.target.value.replace(/\D/g, ""))}
                      className="h-12 rounded-xl bg-white"
                      data-testid="input-payer-bank-account-number"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Account Name</Label>
                    <div
                      className="h-12 rounded-xl border border-slate-200 bg-slate-100/80 px-3.5 flex items-center text-xs font-semibold text-slate-600"
                      data-testid="text-resolved-account-name"
                    >
                      {resolvingAccount ? (
                        <span className="flex items-center gap-2 text-slate-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding your account…
                        </span>
                      ) : resolvedAccountName ? (
                        <span className="text-slate-900 font-bold">{resolvedAccountName}</span>
                      ) : (
                        <span>Shown once we find your account</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <Checkbox
                      id="saveAccountForNextTime"
                      checked={saveAccountForNextTime}
                      onCheckedChange={(checked) => setSaveAccountForNextTime(Boolean(checked))}
                      data-testid="checkbox-save-payer-account"
                    />
                    <Label htmlFor="saveAccountForNextTime" className="text-xs text-slate-600 font-normal cursor-pointer">
                      Save this account to my profile for next time
                    </Label>
                  </div>

                  {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-sm"
                    disabled={busy || !newBankName || newAccountNumber.replace(/\D/g, "").length < 6}
                    data-testid="button-save-payer-bank-account"
                  >
                    {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Save and continue"}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleCancelPayment}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Cancel Payment
                    </button>
                  </div>
                </form>
              )}
            </CardContent>

            {/* Bottom Blue Footer Bar */}
            <div className="bg-blue-600 py-3.5 flex items-center justify-center gap-2 text-white" data-testid="checkout-footer">
              <RhemitoRibbonMark className="w-6 h-6 text-white" />
            </div>
          </Card>
        </motion.div>
      </Shell>
    );
  }

  // ─── 4. FIRST SCREEN — PAYMENT SUMMARY (SenderScreen-1, before identification) ──

  if (!started) {
    return (
      <Shell>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl">
          <MitoSummaryCard request={request} busy={busy} onPay={handlePayNowClick} />
        </motion.div>
      </Shell>
    );
  }

  // ─── 5. EMAIL VERIFICATION & CONDITIONAL MINI-KYC (SenderScreen-2, 3, 4) ────

  return (
    <Shell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl">
        <Card className="shadow-xl overflow-hidden border-2 border-blue-600 bg-white">
          {/* Header Summary */}
          <div className="bg-white text-slate-900 px-6 pt-6 pb-3 space-y-3 text-center" data-testid="checkout-summary">
            <p className="text-xs font-bold tracking-[0.2em] text-blue-600 uppercase">Mito Payment</p>

            {/* Green confirmation toast banner when 6-digit code has been sent (SenderScreen-3 & 4) */}
            {verifyStage === "code_sent" && showCodeBanner && (
              <div
                className="mx-auto max-w-md rounded-xl border border-emerald-600/50 bg-white px-4 py-3.5 shadow-sm flex items-center justify-between gap-3 text-left"
                data-testid="banner-code-sent"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-emerald-800">Check your email for the confirmation code.</p>
                  {devPin && (
                    <button
                      type="button"
                      onClick={() => setPinCode(devPin)}
                      className="text-[11px] font-mono text-teal-700 hover:underline block"
                      data-testid="button-fill-dev-pin"
                    >
                      Demo code: {devPin} (click to fill)
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCodeBanner(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-slate-700">Payment Request From</p>
              <p className="text-xl font-extrabold text-slate-900 uppercase leading-snug" data-testid="checkout-requester-name">
                {request.requesterName}
              </p>
              {request.requestNumber && <p className="text-xs text-slate-500 mt-1">Ref {request.requestNumber}</p>}
            </div>

            <div>
              <p className="text-xs text-slate-500">You pay</p>
              <p className="text-5xl font-bold tracking-tight text-blue-600 mt-1" data-testid="checkout-amount">
                {request.currency} {formatMoney(request.amount)}
              </p>
            </div>
          </div>

          <CardContent className="p-6 pt-3 space-y-4">
            {complianceNotice && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Compliance Check in Progress
                </p>
                <p className="leading-relaxed">{complianceNotice}</p>
              </div>
            )}

            {/* ── STAGE 1: Email entry ONLY (no New to Mito fields upfront, no password) ── */}
            {verifyStage === "email_only" && (
              <form
                onSubmit={handleSendCodeSubmit}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4"
                data-testid="ngn-verify-email"
              >
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-900">Verify Your Email To Continue</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Confirm the email we should use for your receipt. We will email a 6-digit code that expires in 30 minutes.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payerEmail" className="text-xs font-medium text-slate-600">Email</Label>
                  <Input
                    id="payerEmail"
                    type="email"
                    placeholder="your.email@example.com"
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    className="bg-white h-11"
                    data-testid="input-payer-email"
                    required
                    autoFocus
                  />
                </div>

                {errorMessage && <p className="text-xs text-destructive" data-testid="error-auth">{errorMessage}</p>}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm"
                  disabled={busy}
                  data-testid="button-check-email"
                >
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Send code
                </Button>
              </form>
            )}

            {/* ── STAGE 2: 6-Digit Confirmation Code + Conditional "New to Mito?" (SenderScreen-3 & 4) ── */}
            {verifyStage === "code_sent" && (
              <form
                onSubmit={handleVerifyCodeAndPay}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4"
                data-testid="payer-auth-pin"
              >
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-900">Verify Your Email To Continue</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Enter the 6-digit code we emailed to <span className="text-slate-700 font-medium">{payerEmail}</span>. The code expires in 30 minutes — request a new one if it has expired.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lockedPayerEmail" className="text-xs font-medium text-slate-600">Email</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifyStage("email_only");
                        setPinCode("");
                        setErrorMessage("");
                      }}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                      data-testid="button-edit-email"
                    >
                      Edit
                    </button>
                  </div>
                  <Input
                    id="lockedPayerEmail"
                    type="email"
                    value={payerEmail}
                    readOnly
                    className="bg-amber-50/60 text-slate-700 border-slate-200 h-11"
                    data-testid="payer-email-chip"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pinCode" className="text-xs font-medium text-slate-600">Confirmation code</Label>
                  <Input
                    id="pinCode"
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                    className="bg-white h-12 text-base border-blue-600 focus-visible:ring-blue-600"
                    data-testid="input-pin-code"
                    required
                    autoFocus
                  />
                </div>

                {/* Only show "New to Mito?" mini-KYC fields if this email has NOT been registered/verified before */}
                {!isKnownEmailSender && (
                  <NewToMitoFields
                    regAccountType={regAccountType}
                    setRegAccountType={setRegAccountType}
                    regFirstName={regFirstName}
                    setRegFirstName={setRegFirstName}
                    regLastName={regLastName}
                    setRegLastName={setRegLastName}
                    regGender={regGender}
                    setRegGender={setRegGender}
                    bizName={bizName}
                    setBizName={setBizName}
                  />
                )}

                {errorMessage && <p className="text-xs text-destructive" data-testid="error-auth">{errorMessage}</p>}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm"
                  disabled={busy || !pinSent}
                  data-testid="button-verify-pin-pay"
                >
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Verify and pay
                </Button>

                <div>
                  <button
                    type="button"
                    disabled={busy || pinCooldown > 0}
                    onClick={handleResendCode}
                    className="text-xs font-semibold text-blue-600 hover:underline disabled:text-slate-400"
                    data-testid="button-send-pin"
                  >
                    {pinCooldown > 0 ? `Resend code in ${pinCooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            )}

            {/* ── STAGE 3: Email Link (/pay/e/:token) for a brand-new sender — NO 6-digit OTP needed ── */}
            {verifyStage === "email_link_profile" && (
              <form
                onSubmit={handleEmailLinkProfileContinue}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4"
                data-testid="email-link-direct-form"
              >
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-900">Complete Your Details To Continue</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Your email was verified from your payment request link. Confirm your details below to proceed to payment.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emailLinkAddress" className="text-xs font-medium text-slate-600">Email</Label>
                  <Input
                    id="emailLinkAddress"
                    type="email"
                    placeholder="Confirm your email"
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    readOnly={Boolean(request.demoPayerEmail)}
                    className={request.demoPayerEmail ? "bg-amber-50/60 text-slate-700 border-slate-200 h-11" : "bg-white h-11"}
                    data-testid="input-payer-email"
                    required
                  />
                </div>

                {!request.isKnownSender && (
                  <NewToMitoFields
                    regAccountType={regAccountType}
                    setRegAccountType={setRegAccountType}
                    regFirstName={regFirstName}
                    setRegFirstName={setRegFirstName}
                    regLastName={regLastName}
                    setRegLastName={setRegLastName}
                    regGender={regGender}
                    setRegGender={setRegGender}
                    bizName={bizName}
                    setBizName={setBizName}
                  />
                )}

                {errorMessage && <p className="text-xs text-destructive" data-testid="error-auth">{errorMessage}</p>}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm"
                  disabled={busy}
                  data-testid="button-email-link-continue"
                >
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Continue to payment
                </Button>
              </form>
            )}

            {/* Footer Notice */}
            <div className="pt-2 border-t border-border flex items-center justify-end text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <LifeBuoy className="w-3.5 h-3.5" /> {request.legalEntity.supportUrl}
              </span>
            </div>
          </CardContent>

          <div className="bg-blue-600 py-3.5 flex items-center justify-center gap-2 text-white" data-testid="checkout-footer">
            <img src={logo} alt="" className="w-5 h-5 object-contain brightness-0 invert" />
            <span className="text-lg font-bold lowercase font-display">rhemito</span>
          </div>
        </Card>
      </motion.div>
    </Shell>
  );
}

// ─── Subcomponents & Layout Helpers ──────────────────────────────────────────

function NewToMitoFields(props: {
  regAccountType: "individual" | "business";
  setRegAccountType: (v: "individual" | "business") => void;
  regFirstName: string;
  setRegFirstName: (v: string) => void;
  regLastName: string;
  setRegLastName: (v: string) => void;
  regGender: string;
  setRegGender: (v: string) => void;
  bizName: string;
  setBizName: (v: string) => void;
}) {
  const {
    regAccountType,
    setRegAccountType,
    regFirstName,
    setRegFirstName,
    regLastName,
    setRegLastName,
    regGender,
    setRegGender,
    bizName,
    setBizName,
  } = props;

  return (
    <div className="space-y-3.5 pt-1" data-testid="new-to-mito-fields">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-800">New to Mito?</p>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5" role="radiogroup" aria-label="Account type">
          {(["individual", "business"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={regAccountType === t}
              onClick={() => setRegAccountType(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                regAccountType === t ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
              data-testid={`button-ngn-account-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {regAccountType === "individual" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ngnFirstName" className="text-xs font-medium text-slate-600">First name</Label>
              <Input
                id="ngnFirstName"
                value={regFirstName}
                onChange={(e) => setRegFirstName(e.target.value)}
                className="bg-white h-10"
                data-testid="input-ngn-first-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ngnLastName" className="text-xs font-medium text-slate-600">Last name</Label>
              <Input
                id="ngnLastName"
                value={regLastName}
                onChange={(e) => setRegLastName(e.target.value)}
                className="bg-white h-10"
                data-testid="input-ngn-last-name"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Gender</Label>
            <Select value={regGender} onValueChange={setRegGender}>
              <SelectTrigger className="bg-white sm:w-1/2 h-10" data-testid="select-ngn-gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {genderOptions.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ngnBusinessName" className="text-xs font-medium text-slate-600">Business name</Label>
            <Input
              id="ngnBusinessName"
              placeholder="Registered company name"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              className="bg-white h-10"
              data-testid="input-reg-business-name"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ngnBizFirstName" className="text-xs font-medium text-slate-600">Contact first name</Label>
              <Input
                id="ngnBizFirstName"
                value={regFirstName}
                onChange={(e) => setRegFirstName(e.target.value)}
                className="bg-white h-10"
                data-testid="input-ngn-first-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ngnBizLastName" className="text-xs font-medium text-slate-600">Contact last name</Label>
              <Input
                id="ngnBizLastName"
                value={regLastName}
                onChange={(e) => setRegLastName(e.target.value)}
                className="bg-white h-10"
                data-testid="input-ngn-last-name"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RhemitoRibbonMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 40" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 4H26L18 16L26 28L16 21L6 34V4Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-xl mb-5 flex items-center gap-2.5">
        <img src={logo} alt="Rhemito Logo" className="w-9 h-9 object-contain" />
        <span className="text-lg font-bold text-slate-800 font-display">Rhemito</span>
      </div>
      {children}
    </div>
  );
}

function StatusCard(props: { icon: React.ReactNode; title: string; testId: string; children?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl">
      <Card className="shadow-xl" data-testid={props.testId}>
        <div className="bg-slate-100/80 p-5 border-b border-border flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center">
            {props.icon}
          </div>
          <h1 className="text-lg font-bold text-slate-900 font-display">{props.title}</h1>
        </div>
        <CardContent className="p-5 space-y-3">{props.children}</CardContent>
      </Card>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between px-3.5 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function formatMoney(v: string | number | null | undefined): string {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PaymentBreakdown({ request }: { request: PublicRequestView }) {
  const total = parseFloat(request.amount);
  const fee = parseFloat(request.feeAmount ?? "0") || 0;
  const actualSent = total - fee;
  const payoutCurrency = request.payoutCurrency ?? request.currency;
  const crossCurrency = payoutCurrency !== request.currency;
  const rate = request.fxRate ?? null;
  const rateNum = (n: number) =>
    n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const rateText =
    rate && rate > 0
      ? rate >= 1
        ? `1 ${request.currency} = ${rateNum(rate)} ${payoutCurrency}`
        : `${rateNum(1 / rate)} ${request.currency} = 1 ${payoutCurrency}`
      : "Not available";
  const last4 = (request.payoutAccountMasked ?? "").replace(/\D/g, "").slice(-4);
  const payoutSymbol = CURRENCY_SYMBOLS[payoutCurrency] ?? `${payoutCurrency} `;
  const receiveValue = request.payoutAmount
    ? `${payoutSymbol}${formatMoney(request.payoutAmount)}`
    : !crossCurrency
      ? `${payoutSymbol}${formatMoney(actualSent)}`
      : "Not available";
  const line = "flex items-start justify-between gap-4 text-[15px]";

  return (
    <div className="space-y-3" data-testid="payment-breakdown">
      <div className="rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
        <p className="text-base font-semibold text-slate-900">Payment breakdown</p>

        <div className={line}>
          <div>
            <p className="font-semibold text-blue-600">You pay</p>
            <p className="text-xs text-slate-500">Locked</p>
          </div>
          <span className="font-semibold tabular-nums text-blue-600" data-testid="breakdown-you-pay">
            {request.currency} {formatMoney(total)}
          </span>
        </div>

        <div className={line}>
          <span className="text-slate-700">Transaction fee ({request.currency})</span>
          <span className="font-semibold tabular-nums text-red-600" data-testid="breakdown-fee">
            {request.currency} {formatMoney(fee)}
          </span>
        </div>

        <div className={line}>
          <span className="text-slate-700">Actual sent</span>
          <span className="font-semibold tabular-nums text-slate-900" data-testid="breakdown-actual-sent">
            {request.currency} {formatMoney(actualSent)}
          </span>
        </div>

        {crossCurrency && (
          <div className={line}>
            <span className="text-slate-700">Exchange rate</span>
            <span className="font-semibold tabular-nums text-slate-900" data-testid="breakdown-rate">{rateText}</span>
          </div>
        )}

        <div className={line}>
          <div>
            <p className="font-semibold text-blue-600">They receive in bank</p>
            {crossCurrency && request.fxRateIsIndicative !== false && (
              <p className="text-xs text-slate-500">Indicative</p>
            )}
          </div>
          <span className="font-semibold tabular-nums text-blue-600" data-testid="breakdown-receive">{receiveValue}</span>
        </div>

        {request.payoutBankName && (
          <p className="text-sm text-slate-700" data-testid="breakdown-bank">
            Paid into {request.payoutBankName}{last4 ? ` · ****${last4}` : ""}.
          </p>
        )}

        <p className="rounded-lg bg-orange-50 px-3.5 py-3 text-sm text-slate-700">
          This is the amount you send. The fee and what they receive are calculated from it.
        </p>
      </div>
    </div>
  );
}

function MitoSummaryCard({ request, busy, onPay }: { request: PublicRequestView; busy?: boolean; onPay: () => void }) {
  return (
    <Card className="shadow-xl overflow-hidden border-2 border-blue-600 bg-white" data-testid="mito-summary-card">
      <div className="px-6 pt-6 pb-2 space-y-4 text-center" data-testid="checkout-summary">
        <p className="text-xs font-bold tracking-[0.2em] text-blue-600 uppercase">Mito Payment</p>
        <div>
          <p className="text-sm font-semibold text-slate-700">Payment Request From</p>
          <p className="text-xl font-extrabold text-slate-900 uppercase leading-snug" data-testid="checkout-requester-name">
            {request.requesterName}
          </p>
          <p className="text-xs text-slate-500 mt-1">Ref {request.requestNumber}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">You pay</p>
          <p className="text-5xl font-bold tracking-tight text-blue-600 mt-1" data-testid="checkout-amount">
            {request.currency} {formatMoney(request.amount)}
          </p>
        </div>
      </div>
      <CardContent className="p-6 pt-3 space-y-4">
        <PaymentBreakdown request={request} />
        <Button
          className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
          onClick={onPay}
          disabled={busy}
          data-testid="button-start-pay"
        >
          {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…</> : "Pay now"}
        </Button>
        <p className="flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg p-2 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
          Anti-Scam Notice: Rhemito will never ask for your password or SMS codes. Only pay requests you expect.
        </p>
      </CardContent>
      <div className="bg-blue-600 py-3.5 flex items-center justify-center gap-2 text-white" data-testid="checkout-footer">
        <img src={logo} alt="" className="w-5 h-5 object-contain brightness-0 invert" />
        <span className="text-lg font-bold lowercase font-display">rhemito</span>
      </div>
    </Card>
  );
}
