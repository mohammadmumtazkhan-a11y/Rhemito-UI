/**
 * Public payment-request checkout — /pay/:token & /pay/e/:emailToken.
 *
 * Full Payer Journey:
 * 1. Dual link handling: copyable link vs email-notification link (with masked recipient).
 * 2. Pre-auth security: minimal requester info (name, amount, currency, expiry).
 * 3. Payer auth & PIN verification (inline sign-in / PIN verification).
 * 4. Compliance gating (mini-KYC / AML checks).
 * 5. 10-minute server-controlled payment session with live countdown.
 * 6. Atomic submission & locking.
 * 7. Result screens (Success with 60s redirect, Failed with Try Again, Expired with Renewal Request, Pending, Cancelled).
 */

import { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  LifeBuoy,
  Loader2,
  Lock,
  ShieldCheck,
  Clock,
  User,
  Mail,
  KeyRound,
  CreditCard,
  Building2,
  Wallet,
  ArrowRight,
  RefreshCw,
  Info,
  Check,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// @ts-ignore
import logo from "../assets/rhemito-logo-blue.png";
import {
  getPublicRequest,
  startPayerSession,
  checkEmailRegistered,
  sendPayerVerificationPin,
  verifyPayerVerificationPin,
  createIntent,
  devAuthorizeIntent,
  requestNewLink,
  reportRequest,
  METHOD_LABELS,
  type PublicRequestView,
  type Quote,
} from "@/lib/requests";
import { countries, genderOptions } from "@/data/countries";
import PhoneInput from "@/pages/Auth/components/PhoneInput";
import PasswordInput from "@/pages/Auth/components/PasswordInput";

// Mock directors list — in production this would come from a company lookup API
// (same list as the /sign-in-sign-up business registration flow).
const mockDirectors = [
  "John Smith",
  "Jane Doe",
  "Robert Johnson",
  "Sarah Williams",
  "Michael Brown",
];
import { useAuth } from "@/hooks/use-auth";
import { CURRENCY_SYMBOLS } from "@shared/currencies";
import { formatHumanDate } from "@shared/invoice-logic";
import { DEMO_PAYER_CREDENTIALS, PROTOTYPE_MASTER_PASSWORD } from "@shared/schema";

type FlowStep = "pre_auth" | "session_active" | "session_expired" | "authorizing" | "status" | "report";

export default function RequestCheckout() {
  const params = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const token = params.id;
  const isEmailLink = location.startsWith("/pay/e/");

  const { user: authUser, isAuthenticated } = useAuth();

  // Navigation & Step State
  const [step, setStep] = useState<FlowStep>("pre_auth");
  // Identifier-first payer auth: email → (registered? password : PIN → registration)
  const [authStep, setAuthStep] = useState<"email" | "password" | "pin" | "register">("email");
  const [useOtherAccount, setUseOtherAccount] = useState(false);

  // Identification State
  const [payerEmail, setPayerEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [askPayerPassword, setAskPayerPassword] = useState(false);
  const [confirmPayerPassword, setConfirmPayerPassword] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [pinSent, setPinSent] = useState(false);
  const [pinCooldown, setPinCooldown] = useState(0);
  const [verifiedRegistrationEmail, setVerifiedRegistrationEmail] = useState("");
  const [devPin, setDevPin] = useState("");

  // Register Form State
  const [regAccountType, setRegAccountType] = useState<"individual" | "business">("individual");
  const [regFirstName, setRegFirstName] = useState("");
  const [regMiddleName, setRegMiddleName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regDob, setRegDob] = useState("");
  const [regGender, setRegGender] = useState("");
  const [regPhoneCode, setRegPhoneCode] = useState("");
  const [regPhoneNumber, setRegPhoneNumber] = useState("");
  const [regCountry, setRegCountry] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Business registration — two steps, mirroring /sign-in-sign-up:
  // step 1 business details, step 2 director details + password.
  const [bizStep, setBizStep] = useState<1 | 2>(1);
  const [bizName, setBizName] = useState("");
  const [bizRegNo, setBizRegNo] = useState("");
  const [bizPhoneCode, setBizPhoneCode] = useState("");
  const [bizPhoneNumber, setBizPhoneNumber] = useState("");
  const [dirName, setDirName] = useState("");
  const [dirDob, setDirDob] = useState("");
  const [dirGender, setDirGender] = useState("");
  const [dirPhoneCode, setDirPhoneCode] = useState("");
  const [dirPhoneNumber, setDirPhoneNumber] = useState("");
  const [dirPassword, setDirPassword] = useState("");
  const [dirConfirmPassword, setDirConfirmPassword] = useState("");

  // Session State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(600);
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [payerDisplayName, setPayerDisplayName] = useState<string>("");

  // Payment Execution State
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);

  // Renewal / Report State
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
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

  // Pre-fill email from auth or masked recipient
  useEffect(() => {
    if (authUser?.email) {
      setPayerEmail(authUser.email);
    }
  }, [authUser]);

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
    const shouldRedirect = (request?.status === "paid_out" && step === "status")
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

  // Format session timer mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Prototype-only helper: the sender email the requester provided is seeded as
  // a registered demo payer (fixed demo password) and shown here so the
  // sign-in path can be demonstrated. The server only exposes demoPayerEmail
  // in dev/demo mode — real production never shows demo credentials. Any other
  // email follows the PIN verification + registration flow.
  const demoPayerHint = request.demoPayerEmail ? (
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-2.5 text-[11px] text-teal-900 space-y-1" data-testid="demo-payer-hint">
      <p className="font-semibold flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 text-teal-600" /> Demo registered payer
      </p>
      <p className="font-mono break-all">
        Email: {request.demoPayerEmail} &nbsp;·&nbsp; Password: {DEMO_PAYER_CREDENTIALS.password}
      </p>
      <p>The requester expects this sender to pay. Sign in with these demo credentials, or use any other email to register via PIN verification.</p>
    </div>
  ) : null;

  // Country ↔ dial-code are linked both ways: picking a country sets the
  // matching dial code, and picking a dial code first sets the country.
  const handleRegPhoneCodeChange = (code: string) => {
    setRegPhoneCode(code);
    const match = countries.find((c) => c.dialCode === code);
    if (match) setRegCountry(match.code);
  };
  const handleBizPhoneCodeChange = (code: string) => {
    setBizPhoneCode(code);
    const match = countries.find((c) => c.dialCode === code);
    if (match) setRegCountry(match.code);
  };
  const handleRegCountryChange = (code: string) => {
    setRegCountry(code);
    const found = countries.find((c) => c.code === code);
    if (found) {
      if (regAccountType === "individual") {
        setRegPhoneCode(found.dialCode);
      } else {
        setBizPhoneCode(found.dialCode);
        setDirPhoneCode(found.dialCode);
      }
    }
  };
  const regCountrySelect = (
    <div className="space-y-1">
      <Label className="text-xs font-medium">
        Country <span className="text-destructive">*</span>
      </Label>
      <Select value={regCountry} onValueChange={handleRegCountryChange}>
        <SelectTrigger data-testid="select-register-country" className="bg-white">
          <SelectValue placeholder="Select country" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {countries.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.flag} {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // Demo accounts whose password is the shared demo password: the request's
  // seeded sender email and the seeded dashboard demo user. Only meaningful in
  // dev/demo mode (demoPayerEmail is absent in production).
  const isDemoPayerAccount = (email: string) =>
    !!request.demoPayerEmail
    && (email.trim().toLowerCase() === request.demoPayerEmail || email.trim().toLowerCase() === "demo@rhemito.com");
  const demoPasswordHint = (
    <p className="text-[11px] text-teal-700 font-mono" data-testid="demo-password-hint">
      Demo password: {DEMO_PAYER_CREDENTIALS.password}
    </p>
  );
  // Prototype master password works for ANY account in demo mode.
  const masterPasswordHint = request.demoPayerEmail ? (
    <p className="text-[11px] text-teal-700 font-mono" data-testid="master-password-hint">
      Prototype master password (any account): {PROTOTYPE_MASTER_PASSWORD}
    </p>
  ) : null;

  // ─── AUTHENTICATION & PIN ACTIONS ──────────────────────────────────────────

  /**
   * Identifier-first auth: capture the email, then branch.
   * Registered → password sign-in. Unknown → send a verification PIN.
   */
  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = payerEmail.trim().toLowerCase();
    if (!email) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const { registered } = await checkEmailRegistered(email);
      if (registered) {
        setAuthStep("password");
        return;
      }
      const result = await sendPayerVerificationPin(token!, email, isEmailLink);
      setPinSent(true);
      setPinCooldown(result.resendAfterSeconds);
      setDevPin(result.devPin ?? "");
      setAuthStep("pin");
    } catch (err: any) {
      setErrorMessage(err?.message || "Please check your email address and try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendPin = async () => {
    const targetEmail = payerEmail.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMessage("Please enter your email address to receive a verification PIN.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await sendPayerVerificationPin(token!, targetEmail, isEmailLink);
      setPinSent(true);
      setPinCooldown(result.resendAfterSeconds);
      setDevPin(result.devPin ?? "");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to send PIN. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleStartPayerFlow = async () => {
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
      setPayerDisplayName(session.payerName);
      await refetch();
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
   * Authenticated payer card: the first click reveals the password field, the
   * second verifies the password against the account before the 10-minute
   * payment session may open.
   */
  const handleContinueAuthenticated = async () => {
    if (!authUser) return;
    if (!askPayerPassword) {
      setAskPayerPassword(true);
      setErrorMessage("");
      return;
    }
    if (!confirmPayerPassword) {
      setErrorMessage("Please enter your password to continue.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authUser.email, password: confirmPayerPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid password.");
      }
      setConfirmPayerPassword("");
      await handleStartPayerFlow();
    } catch (err: any) {
      setErrorMessage(err.message || "Login failed. Please verify your password.");
      setBusy(false);
    }
  };

  const handleLoginAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerEmail.trim() || !loginPassword) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: payerEmail.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials.");
      }
      await handleStartPayerFlow();
    } catch (err: any) {
      setErrorMessage(err.message || "Login failed. Please verify your password.");
      setBusy(false);
    }
  };

  /**
   * Register form, details step. Individual registers directly; business first
   * collects the company details and continues to the director-details step
   * (same two-step flow as /sign-in-sign-up).
   */
  const handleRegisterDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (regAccountType === "business") {
      if (!bizName.trim() || !bizRegNo.trim()) {
        setErrorMessage("Please enter the business name and registration number.");
        return;
      }
      if (!regCountry) {
        setErrorMessage("Please select the business country.");
        return;
      }
      if (!dirPhoneCode) {
        const found = countries.find((c) => c.code === regCountry);
        if (found) setDirPhoneCode(found.dialCode);
      }
      setBizStep(2);
      return;
    }
    void handleRegisterAndContinue(e);
  };

  const handleRegisterAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedRegistrationEmail) {
      setErrorMessage("Verify your email with the six-digit PIN before creating the account.");
      setAuthStep("email");
      return;
    }
    if (!regFirstName.trim() || !regLastName.trim()) {
      setErrorMessage("Please enter your first and last name.");
      return;
    }
    if (!regDob) {
      setErrorMessage("Please enter your date of birth.");
      return;
    }
    if (!regGender) {
      setErrorMessage("Please select your gender.");
      return;
    }
    if (!regPhoneNumber.trim()) {
      setErrorMessage("Please enter your mobile number.");
      return;
    }
    if (!regCountry) {
      setErrorMessage("Please select your country.");
      return;
    }
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(regPassword)) {
      setErrorMessage("Password must be at least 8 characters with 1 uppercase letter and 1 number.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: "individual",
          email: verifiedRegistrationEmail,
          password: regPassword,
          firstName: regFirstName.trim(),
          middleName: regMiddleName.trim() || null,
          lastName: regLastName.trim(),
          dateOfBirth: regDob,
          gender: regGender,
          mobileCode: regPhoneCode,
          mobileNumber: regPhoneNumber,
          country: regCountry,
          paymentRequestToken: token,
          isEmailLink,
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regData.message || "Registration failed.");
      }
      await handleStartPayerFlow();
    } catch (err: any) {
      setErrorMessage(err.message || "Registration failed.");
      setBusy(false);
    }
  };

  /** Business registration, director-details step (password rules as /sign-in-sign-up). */
  const handleBusinessRegisterAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedRegistrationEmail) {
      setErrorMessage("Verify your email with the six-digit PIN before creating the account.");
      setAuthStep("email");
      return;
    }
    if (!dirName) {
      setErrorMessage("Please select the director.");
      return;
    }
    if (!dirDob) {
      setErrorMessage("Please enter the director's date of birth.");
      return;
    }
    if (!dirGender) {
      setErrorMessage("Please select the director's gender.");
      return;
    }
    if (!dirPhoneNumber.trim()) {
      setErrorMessage("Please enter the director's mobile number.");
      return;
    }
    if (dirPassword !== dirConfirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(dirPassword)) {
      setErrorMessage("Password must be 8+ characters with 1 uppercase letter, 1 number and 1 special character.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: "business",
          email: verifiedRegistrationEmail,
          country: regCountry,
          businessName: bizName.trim(),
          businessRegNo: bizRegNo.trim(),
          businessPhoneCode: bizPhoneCode || undefined,
          businessPhoneNumber: bizPhoneNumber || undefined,
          directorName: dirName,
          dateOfBirth: dirDob,
          gender: dirGender,
          mobileCode: dirPhoneCode,
          mobileNumber: dirPhoneNumber,
          password: dirPassword,
          confirmPassword: dirConfirmPassword,
          paymentRequestToken: token,
          isEmailLink,
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regData.message || "Registration failed.");
      }
      await handleStartPayerFlow();
    } catch (err: any) {
      setErrorMessage(err.message || "Registration failed.");
      setBusy(false);
    }
  };

  const handlePinVerifyAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode || pinCode.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit PIN.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const email = payerEmail.trim().toLowerCase();
      await verifyPayerVerificationPin(token!, email, pinCode, isEmailLink);
      setVerifiedRegistrationEmail(email);
      setAuthStep("register");
      setPinSent(false);
      setPinCode("");
    } catch (err: any) {
      setErrorMessage(err?.message || "The PIN could not be verified.");
    } finally {
      setBusy(false);
    }
  };

  // ─── PAYMENT SUBMISSION & AUTHORISATION ───────────────────────────────────

  const handleMethodSelect = async (method: string) => {
    setSelectedMethod(method);
    setBusy(true);
    setErrorMessage("");
    try {
      if (!activeSessionId) throw new Error("Start a new payment session to continue.");
      const intent = await createIntent(token!, method, activeSessionId, isEmailLink);
      setIntentId(intent.intentId);
      setPaymentReference(intent.paymentReference);
      setStep("authorizing");
      await refetch();
    } catch (err: any) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to initiate payment submission.");
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

  const handleReportSubmit = async () => {
    if (!reportReason.trim()) return;
    setBusy(true);
    try {
      await reportRequest(token!, reportReason.trim(), isEmailLink);
      setReportSent(true);
    } catch {
      setErrorMessage("Report could not be submitted. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ─── 1. STATUS & RESULT PAGES ──────────────────────────────────────────────

  if (step === "session_expired") {
    return (
      <Shell>
        <StatusCard icon={<Clock className="w-8 h-8 text-amber-600" />} title="Payment Session Expired" testId="session-expired-card">
          <p className="text-sm text-slate-700">No payment was submitted. Start a new session if this request is still available.</p>
          <Button className="w-full" onClick={() => handleStartPayerFlow()} disabled={busy} data-testid="button-start-new-session">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Start New Payment Session
          </Button>
          <p className="text-xs text-center text-muted-foreground">Returning home in {redirectCountdown}s.</p>
          <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>Go to Home Page Now</Button>
        </StatusCard>
      </Shell>
    );
  }

  // The explicit authorising step (provider hand-off / dev authorisation) takes
  // precedence over the generic processing screen — otherwise the intent's
  // `payment_processing` status would hide the authorisation UI and the payment
  // could never be completed in development.
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
                  className="w-full bg-primary hover:bg-primary/90"
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
              <Row label="Payment Reference" value={<span className="font-mono">{paymentReference || `PAY-${request.requestNumber}`}</span>} />
              <Row label="Request Number" value={request.requestNumber} />
              <Row label="Paid to" value={request.requesterName} />
              {request.purpose && <Row label="Purpose" value={request.purpose.replace(/_/g, " ")} />}
              {request.reference && <Row label="Reference Note" value={request.reference} />}
              <Row label="Date & Time" value={new Date().toLocaleString()} />
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-center text-xs text-muted-foreground border border-slate-200">
              <p>Redirecting to home in <strong className="text-primary">{redirectCountdown}s</strong>…</p>
            </div>

            <Button
              className="w-full bg-primary hover:bg-primary/90"
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
            <Button className="w-full" onClick={() => handleStartPayerFlow()} disabled={busy} data-testid="button-try-again">Try Again</Button>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>Go to Home Page</Button>
          </StatusCard>
        </Shell>
      );
    }

    // Pending state
    return (
      <Shell>
        <StatusCard
          icon={<Loader2 className="w-8 h-8 animate-spin text-primary" />}
          title="Payment Processing…"
          testId="pending-card"
        >
          <p className="text-sm text-slate-700 text-center">A payment is being processed. The actual payer will receive the final result by email.</p>
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

  // ─── 2. REPORT FLOW ────────────────────────────────────────────────────────

  if (step === "report") {
    return (
      <Shell>
        <StatusCard icon={<Flag className="w-8 h-8 text-red-600" />} title="Report This Request" testId="report-card">
          {reportSent ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Report Submitted
              </p>
              <p className="text-xs leading-relaxed">
                Thank you for notifying us. Our trust and compliance team will review this request. Do not send money if you have any doubts.
              </p>
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setStep("pre_auth")}>
                Return to Checkout
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                If you suspect fraud, impersonation, or an unsolicited request, please report it immediately.
              </p>
              <textarea
                className="w-full rounded-xl border border-border p-3 text-sm min-h-24 bg-white focus:outline-primary"
                placeholder="Describe why you are reporting this request (e.g. suspicious activity, unauthorized demand)..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                data-testid="input-report-reason"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("pre_auth")}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={!reportReason.trim() || busy}
                  onClick={handleReportSubmit}
                  data-testid="button-submit-report"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Submit Report
                </Button>
              </div>
            </div>
          )}
        </StatusCard>
      </Shell>
    );
  }

  // ─── 3. PROVIDER AUTHORISATION (DEVELOPMENT SIMULATION) ────────────────────

  if (step === "authorizing" && intentId) {
    return (
      <Shell>
        <StatusCard
          icon={<ShieldCheck className="w-8 h-8 text-primary" />}
          title="Authorise Your Payment"
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
              <span className="font-medium text-slate-800">{METHOD_LABELS[selectedMethod ?? ""] ?? selectedMethod}</span>
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
              In production, this step invokes the bank 3-D Secure / Open Banking screen. Clicking below simulates successful provider authorization and triggers signed webhook settlement.
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
                setIntentId(null);
              }}
            >
              Back
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
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

  // ─── 4. SESSION ACTIVE (10-MINUTE SERVER TIMER & METHOD SELECTION) ────────

  if (step === "session_active") {
    return (
      <Shell>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="shadow-xl overflow-hidden border-border/80">
            {/* Header with Timer */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs px-2.5 py-0.5 font-normal">
                    Session Active
                  </Badge>
                  <span className="text-xs text-white/70 font-mono">{request.requestNumber}</span>
                </div>
                {/* 10-Minute Countdown */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                    sessionSecondsLeft < 120 ? "bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse" : "bg-primary/20 text-teal-300 border border-teal-500/30"
                  }`}
                  data-testid="session-timer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTimer(sessionSecondsLeft)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-white/60 uppercase font-semibold">Total Payable</p>
                <p className="text-4xl font-bold tracking-tight mt-0.5" data-testid="checkout-amount">
                  {symbol}{request.amount} <span className="text-lg font-normal text-white/70">{request.currency}</span>
                </p>
              </div>

              <div className="space-y-1 text-xs border-t border-white/10 pt-3">
                <div className="flex justify-between">
                  <span className="text-white/60">Paying as</span>
                  <span className="font-medium">{payerDisplayName || payerEmail || "Guest Payer"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Pay to</span>
                  <span className="font-medium">{request.requesterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Purpose</span>
                  <span className="font-medium capitalize">{request.purpose?.replace(/_/g, " ") ?? "Payment request"}</span>
                </div>
                {request.reference && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Reference</span>
                    <span className="font-medium">{request.reference}</span>
                  </div>
                )}
              </div>
            </div>

            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-800">Select Payment Method</Label>
                <div className="space-y-2">
                  {request.methods.map((m) => {
                    const icon =
                      m === "card" ? <CreditCard className="w-4 h-4 text-blue-600" /> :
                      m === "pay_by_bank" ? <Building2 className="w-4 h-4 text-purple-600" /> :
                      m === "wallet" ? <Wallet className="w-4 h-4 text-teal-600" /> :
                      <Building2 className="w-4 h-4 text-emerald-600" />;

                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={busy}
                        onClick={() => handleMethodSelect(m)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-primary hover:bg-primary/5 transition-all text-left group disabled:opacity-50"
                        data-testid={`button-method-${m}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            {icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{METHOD_LABELS[m] ?? m}</p>
                            <p className="text-[11px] text-muted-foreground">Instant & secure processing</p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                      </button>
                    );
                  })}
                </div>
                {busy && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Initialising secure transaction…
                  </p>
                )}
                {errorMessage && <p className="text-xs text-destructive" data-testid="error-checkout">{errorMessage}</p>}
              </div>

              {/* Disclosures & Anti-Scam */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-[11px] text-slate-600 space-y-2">
                <p>{request.senderFeeNote}</p>
                <p className="flex items-start gap-1.5 text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg p-2 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                  Anti-Scam Notice: Rhemito will never ask for your password or SMS codes. Only pay requests you expect.
                </p>
                <p className="text-muted-foreground">{request.legalEntity.displayName} — {request.legalEntity.safeguardingStatement}</p>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  className="text-red-600 font-medium hover:underline flex items-center gap-1"
                  onClick={() => setStep("report")}
                  data-testid="button-report"
                >
                  <Flag className="w-3.5 h-3.5" /> Report request
                </button>
                <span className="text-muted-foreground flex items-center gap-1">
                  <LifeBuoy className="w-3.5 h-3.5" /> Support: {request.legalEntity.supportUrl}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </Shell>
    );
  }

  // ─── 5. PRE-AUTH IDENTIFICATION & LOGIN SCREEN ─────────────────────────────

  return (
    <Shell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="shadow-xl overflow-hidden border-border/80">
          {/* Header Summary */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 space-y-3" data-testid="checkout-summary">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Payment Request</p>
              <p className="text-xs font-mono text-white/70">{request.requestNumber}</p>
            </div>

            <div>
              <p className="text-xs text-white/60 uppercase font-semibold">Requested Amount</p>
              <p className="text-4xl font-bold tracking-tight mt-0.5" data-testid="checkout-amount">
                {symbol}{request.amount} <span className="text-lg font-normal text-white/70">{request.currency}</span>
              </p>
            </div>

            <div className="space-y-1.5 text-xs border-t border-white/10 pt-3">
              <div className="flex justify-between">
                <span className="text-white/60">Requested by</span>
                <span className="font-medium">{request.requesterName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Purpose</span>
                <span className="font-medium capitalize">{request.purpose?.replace(/_/g, " ") ?? "Payment request"}</span>
              </div>
              {request.reference && (
                <div className="flex justify-between">
                  <span className="text-white/60">Reference</span>
                  <span className="font-medium">{request.reference}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/60">Valid Until</span>
                <span className="font-medium">{formatHumanDate(request.expiryDate)}</span>
              </div>
              {isEmailLink && request.recipientEmailMasked && (
                <div className="flex justify-between bg-white/5 p-2 rounded border border-white/10 text-[11px]">
                  <span className="text-white/70">Recipient Email:</span>
                  <span className="font-mono text-teal-300 font-semibold" data-testid="masked-email">
                    {request.recipientEmailMasked}
                  </span>
                </div>
              )}
            </div>
          </div>

          <CardContent className="p-5 space-y-4">
            {/* Compliance notice if KYC pending */}
            {complianceNotice && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Compliance Check in Progress
                </p>
                <p className="leading-relaxed">{complianceNotice}</p>
              </div>
            )}

            {/* Authenticated user quick proceed vs Switch Account */}
            {isAuthenticated && authUser && !useOtherAccount ? (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Paying as {authUser.firstName ? `${authUser.firstName} ${authUser.lastName || ""}` : authUser.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{authUser.email}</p>
                  </div>
                </div>

                {/* Step-up authentication: an existing session is not enough to
                    open a payment session — the sender confirms the password. */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleContinueAuthenticated();
                  }}
                  className="space-y-3"
                >
                  {askPayerPassword && (
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPayerPassword" className="text-xs font-medium">
                        Confirm your password <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="confirmPayerPassword"
                        type="password"
                        placeholder="Enter your password"
                        value={confirmPayerPassword}
                        onChange={(e) => setConfirmPayerPassword(e.target.value)}
                        data-testid="input-confirm-payer-password"
                        required
                        autoFocus
                      />
                      {isDemoPayerAccount(authUser.email) && demoPasswordHint}
                      {masterPasswordHint}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={busy}
                    data-testid="button-continue-authenticated"
                  >
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                    {askPayerPassword ? "Confirm Password & Continue (10m Session)" : "Continue with this Account (10m Session)"}
                  </Button>
                </form>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUseOtherAccount(true);
                      setAuthStep("email");
                      setAskPayerPassword(false);
                      setConfirmPayerPassword("");
                      setErrorMessage("");
                    }}
                    className="text-xs text-primary font-medium hover:underline"
                    data-testid="button-switch-payer"
                  >
                    Not your account? Sign in or register as a different payer →
                  </button>
                </div>
              </div>
            ) : (
              /* Identifier-first payer auth: email → password (registered) or PIN → registration (new) */
              <div className="space-y-4" data-testid={`payer-auth-${authStep}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-700 font-semibold">
                    {isEmailLink ? "Identify yourself to pay this request:" : "Identify yourself to open secure payment session:"}
                  </p>
                  {isAuthenticated && authUser && useOtherAccount && (
                    <button
                      type="button"
                      onClick={() => setUseOtherAccount(false)}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      ← Back to {authUser.email}
                    </button>
                  )}
                </div>

                {/* Locked email chip once the email step is passed */}
                {authStep !== "email" && (
                  <div className="flex items-center justify-between gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg" data-testid="payer-email-chip">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-800 min-w-0">
                      <Mail className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{payerEmail}</span>
                      {authStep === "register" && (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 gap-1 font-medium shrink-0">
                          <Check className="w-3 h-3" /> Verified
                        </Badge>
                      )}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-primary font-medium hover:underline shrink-0"
                      onClick={() => {
                        setAuthStep("email");
                        setPinSent(false);
                        setPinCode("");
                        setDevPin("");
                        setErrorMessage("");
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Step 1: Email capture — routes to sign-in or PIN verification */}
                {authStep === "email" && (
                  <form onSubmit={handleEmailCheck} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="payerEmail" className="text-xs font-medium">
                        Email address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="payerEmail"
                        type="email"
                        placeholder={isEmailLink && request.recipientEmailMasked ? "Confirm your full email" : "your.email@example.com"}
                        value={payerEmail}
                        onChange={(e) => setPayerEmail(e.target.value)}
                        data-testid="input-payer-email"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={busy}
                      data-testid="button-check-email"
                    >
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Continue
                    </Button>
                    <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                      We'll check whether you already have a Rhemito account — you'll either sign in with your
                      password or verify this email with a 6-digit PIN.
                    </p>
                    {demoPayerHint}
                  </form>
                )}

                {/* Step 2a: Registered email → password sign-in */}
                {authStep === "password" && (
                  <form onSubmit={handleLoginAndContinue} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="loginPassword" className="text-xs font-medium">
                        Password <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="loginPassword"
                        type="password"
                        placeholder="Enter your password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        data-testid="input-payer-password"
                        required
                        autoFocus
                      />
                      {isDemoPayerAccount(payerEmail) && demoPasswordHint}
                      {masterPasswordHint}
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={busy}
                      data-testid="button-signin-pay"
                    >
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                      Sign In & Open Session
                    </Button>
                    {demoPayerHint}
                  </form>
                )}

                {/* Step 2b: Unknown email → verify ownership with a 6-digit PIN */}
                {authStep === "pin" && (
                  <form onSubmit={handlePinVerifyAndContinue} className="space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      We sent a 6-digit PIN to <strong className="text-slate-800">{payerEmail}</strong>. Enter it below
                      to verify this email and continue.
                      {devPin && <span className="block mt-1 text-[11px] text-teal-700 font-mono">Development PIN: {devPin}</span>}
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="pinCode" className="text-xs font-medium">
                        6-Digit PIN <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="pinCode"
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                        className="text-center font-mono tracking-widest text-lg font-bold"
                        data-testid="input-pin-code"
                        required
                        autoFocus
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={busy || !pinSent}
                      data-testid="button-verify-pin-pay"
                    >
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                      Verify & Continue
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      disabled={busy || pinCooldown > 0}
                      onClick={handleSendPin}
                      data-testid="button-send-pin"
                    >
                      {pinCooldown > 0 ? `Resend PIN in ${pinCooldown}s` : pinSent ? "Resend PIN" : "Send PIN"}
                    </Button>
                  </form>
                )}

                {/* Step 3: PIN-verified new payer → create the account.
                    Business registrations use two steps (business details →
                    director details), mirroring /sign-in-sign-up. */}
                {authStep === "register" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Create your account</p>
                      {regAccountType === "business" && (
                        <span className="text-[11px] text-muted-foreground">
                          {bizStep === 1 ? "Step 1 of 2 — Business details" : "Step 2 of 2 — Director details"}
                        </span>
                      )}
                    </div>

                    {regAccountType === "business" && bizStep === 2 ? (
                      <form onSubmit={handleBusinessRegisterAndContinue} className="space-y-3">
                        {/* Company summary banner */}
                        <div className="bg-slate-50 rounded-lg px-3.5 py-2.5 border border-slate-200">
                          <p className="text-sm font-semibold text-slate-700">{bizName}</p>
                          <p className="text-xs text-slate-400">{bizRegNo}</p>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-medium">
                            Director <span className="text-destructive">*</span>
                          </Label>
                          <Select value={dirName} onValueChange={setDirName}>
                            <SelectTrigger data-testid="select-director-name" className="bg-white">
                              <SelectValue placeholder="Select director name" />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {mockDirectors.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="dirDob" className="text-xs font-medium">
                              Date of Birth <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="dirDob"
                              type="date"
                              value={dirDob}
                              onChange={(e) => setDirDob(e.target.value)}
                              data-testid="input-director-dob"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Gender <span className="text-destructive">*</span>
                            </Label>
                            <Select value={dirGender} onValueChange={setDirGender}>
                              <SelectTrigger data-testid="select-director-gender" className="bg-white">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              <SelectContent>
                                {genderOptions.map((g) => (
                                  <SelectItem key={g.value} value={g.value}>
                                    {g.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <PhoneInput
                          codeValue={dirPhoneCode}
                          numberValue={dirPhoneNumber}
                          onCodeChange={setDirPhoneCode}
                          onNumberChange={setDirPhoneNumber}
                        />

                        <div className="space-y-2 pt-1">
                          <PasswordInput
                            value={dirPassword}
                            onChange={(v) => setDirPassword(v)}
                            label="Password"
                            placeholder="Password"
                          />
                          <PasswordInput
                            value={dirConfirmPassword}
                            onChange={(v) => setDirConfirmPassword(v)}
                            label="Confirm Password"
                            placeholder="Confirm Password"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Must be 8+ characters with 1 uppercase letter, 1 number and 1 special character
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setBizStep(1)}
                            disabled={busy}
                          >
                            Back
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1 bg-primary hover:bg-primary/90"
                            disabled={busy}
                            data-testid="button-register-pay"
                          >
                            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />}
                            Create Account & Pay
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleRegisterDetailsSubmit} className="space-y-3">
                        {/* Account type toggle */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={regAccountType === "individual" ? "default" : "outline"}
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setRegAccountType("individual");
                              setBizStep(1);
                            }}
                            data-testid="button-account-individual"
                          >
                            <User className="w-3.5 h-3.5 mr-1.5" /> Individual
                          </Button>
                          <Button
                            type="button"
                            variant={regAccountType === "business" ? "default" : "outline"}
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setRegAccountType("business");
                              setBizStep(1);
                            }}
                            data-testid="button-account-business"
                          >
                            <Building2 className="w-3.5 h-3.5 mr-1.5" /> Business
                          </Button>
                        </div>

                        {regAccountType === "individual" ? (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label htmlFor="regFirstName" className="text-xs font-medium">
                                  First name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="regFirstName"
                                  placeholder="First name"
                                  value={regFirstName}
                                  onChange={(e) => setRegFirstName(e.target.value)}
                                  data-testid="input-reg-first-name"
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="regLastName" className="text-xs font-medium">
                                  Last name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="regLastName"
                                  placeholder="Last name"
                                  value={regLastName}
                                  onChange={(e) => setRegLastName(e.target.value)}
                                  data-testid="input-reg-last-name"
                                  required
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label htmlFor="regMiddleName" className="text-xs font-medium">
                                  Middle name <span className="text-muted-foreground font-normal">(optional)</span>
                                </Label>
                                <Input
                                  id="regMiddleName"
                                  placeholder="Middle name"
                                  value={regMiddleName}
                                  onChange={(e) => setRegMiddleName(e.target.value)}
                                  data-testid="input-reg-middle-name"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="regDob" className="text-xs font-medium">
                                  Date of Birth <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="regDob"
                                  type="date"
                                  value={regDob}
                                  onChange={(e) => setRegDob(e.target.value)}
                                  data-testid="input-reg-dob"
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs font-medium">
                                Gender <span className="text-destructive">*</span>
                              </Label>
                              <Select value={regGender} onValueChange={setRegGender}>
                                <SelectTrigger data-testid="select-reg-gender" className="bg-white">
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                  {genderOptions.map((g) => (
                                    <SelectItem key={g.value} value={g.value}>
                                      {g.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {regCountrySelect}

                            <PhoneInput
                              codeValue={regPhoneCode}
                              numberValue={regPhoneNumber}
                              onCodeChange={handleRegPhoneCodeChange}
                              onNumberChange={setRegPhoneNumber}
                            />

                            <div className="space-y-1">
                              <Label htmlFor="regPassword" className="text-xs font-medium">
                                Password <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                id="regPassword"
                                type="password"
                                placeholder="Create password"
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                data-testid="input-reg-password"
                                required
                              />
                              <p
                                className={`text-[11px] ${
                                  regPassword && !/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(regPassword) ? "text-destructive" : "text-muted-foreground"
                                }`}
                              >
                                Must be 8+ characters, 1 uppercase, 1 number
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <Label htmlFor="bizName" className="text-xs font-medium">
                                Business Name <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                id="bizName"
                                placeholder="Business name"
                                value={bizName}
                                onChange={(e) => setBizName(e.target.value)}
                                data-testid="input-reg-business-name"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="bizRegNo" className="text-xs font-medium">
                                Business Registration Number <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                id="bizRegNo"
                                placeholder="e.g. 123456789"
                                value={bizRegNo}
                                onChange={(e) => setBizRegNo(e.target.value)}
                                data-testid="input-reg-business-regno"
                                required
                              />
                            </div>
                            {regCountrySelect}

                            <PhoneInput
                              codeValue={bizPhoneCode}
                              numberValue={bizPhoneNumber}
                              onCodeChange={handleBizPhoneCodeChange}
                              onNumberChange={setBizPhoneNumber}
                              label="Business Phone Number"
                            />
                          </>
                        )}

                        <Button
                          type="submit"
                          className="w-full bg-primary hover:bg-primary/90"
                          disabled={busy}
                          data-testid={regAccountType === "business" ? "button-register-continue" : "button-register-pay"}
                        >
                          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          {regAccountType === "business" ? "Continue" : "Create Account & Pay"}
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {errorMessage && <p className="text-xs text-destructive" data-testid="error-auth">{errorMessage}</p>}

            {/* Footer Notice & Report */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-red-600 font-medium hover:underline flex items-center gap-1"
                onClick={() => setStep("report")}
                data-testid="button-report"
              >
                <Flag className="w-3.5 h-3.5" /> Report this request
              </button>
              <span className="text-muted-foreground flex items-center gap-1">
                <LifeBuoy className="w-3.5 h-3.5" /> {request.legalEntity.supportUrl}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Shell>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-md mb-5 flex items-center gap-2.5">
        <img src={logo} alt="Rhemito Logo" className="w-9 h-9 object-contain" />
        <span className="text-lg font-bold text-slate-800 font-display">Rhemito</span>
      </div>
      {children}
    </div>
  );
}

function StatusCard(props: { icon: React.ReactNode; title: string; testId: string; children?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
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
