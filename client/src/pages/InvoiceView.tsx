/**
 * Public invoice payment page — Send Invoice MVP1.
 * Renders the client-facing view of an invoice payment link at /invoice/:token.
 * All state comes from the public API (the server is authoritative for expiry,
 * cancellation and payment status). Payment submission is simulated end-to-end
 * by the server (no real PSP in the prototype).
 *
 * The payer must identify themselves before paying (mirroring the Request
 * Payment link): registered emails sign in with a password; unregistered
 * emails verify a 6-digit PIN and register — the account is activated and the
 * payment session opened in one step.
 */

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2, CreditCard, Building2, Lock, Loader2, AlertCircle, Clock, XCircle, Send,
  ArrowRight, ChevronLeft, FileText, ShieldCheck, Mail, User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordInput as PasswordInputWithToggle } from "@/components/ui/password-input";
import ForgotPassword from "@/pages/Auth/components/ForgotPassword";
import PhoneInput from "@/pages/Auth/components/PhoneInput";
import { countries, genderOptions } from "@/data/countries";
import { checkEmailRegistered } from "@/lib/requests";
import { DEMO_PAYER_CREDENTIALS, PROTOTYPE_MASTER_PASSWORD } from "@shared/schema";
// @ts-ignore
import logo from "../assets/rhemito-logo-blue.png";
import { useToast } from "@/hooks/use-toast";
import {
  getPublicInvoice,
  initiateInvoicePayment,
  requestNewPaymentLinkRequest,
  publicInvoiceDocumentUrl,
  sendInvoiceClientPin,
  verifyInvoiceClientPin,
  type PublicInvoice,
} from "@/lib/invoices";
import { formatHumanDate } from "@shared/invoice-logic";
import { computeInvoiceTotals } from "@shared/invoice-logic";
import { GeneratedInvoiceDocument } from "@/components/invoices/GeneratedInvoiceDocument";

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

type PayStep = "landing" | "choose_method" | "processing";

/** Identifier-first payer auth: email → (registered? password : PIN → registration) → identified. */
type AuthStep = "email" | "password" | "pin" | "register" | "identified";

export default function InvoiceView() {
  const { id: token } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [payStep, setPayStep] = useState<PayStep>("landing");
  const [startingPayment, setStartingPayment] = useState(false);
  const [linkRequestState, setLinkRequestState] = useState<"idle" | "sent">("idle");
  const [requestingLink, setRequestingLink] = useState(false);

  // Payer identification state (mirrors the Request Payment link flow)
  const [authStep, setAuthStep] = useState<AuthStep>("email");
  const [payerEmail, setPayerEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [pinSending, setPinSending] = useState(false);
  const [pinVerifying, setPinVerifying] = useState(false);
  const [devPin, setDevPin] = useState("");
  const [pinCooldown, setPinCooldown] = useState(0);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);

  // Compact registration state — prefilled from the invoice client snapshot
  const [regFirstName, setRegFirstName] = useState("");
  const [regMiddleName, setRegMiddleName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regBusinessName, setRegBusinessName] = useState("");
  const [regBusinessRegNo, setRegBusinessRegNo] = useState("");
  const [regDirectorName, setRegDirectorName] = useState("");
  const [regCountry, setRegCountry] = useState("");
  const [regDob, setRegDob] = useState("");
  const [regGender, setRegGender] = useState("");
  const [regPhoneCode, setRegPhoneCode] = useState("");
  const [regPhoneNumber, setRegPhoneNumber] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // PIN resend cooldown ticker
  useEffect(() => {
    const timer = setInterval(() => setPinCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: invoice, isError, refetch } = useQuery<PublicInvoice>({
    queryKey: [`/api/public/invoices/${token}`],
    queryFn: () => getPublicInvoice(token!),
    refetchInterval: (query) =>
      query.state.data?.status === "payment_processing" ? 2000 : false,
    retry: false,
  });

  if (isError) {
    return <Shell><InvalidLinkCard /></Shell>;
  }
  if (!invoice) {
    return (
      <Shell>
        <div className="py-24 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading invoice…
        </div>
      </Shell>
    );
  }

  const sym = CURRENCY_SYMBOLS[invoice.currency] ?? "";
  const status = invoice.status;

  const handleInitiatePayment = async (method: "card" | "bank_transfer") => {
    if (startingPayment) return;
    setStartingPayment(true);
    try {
      await initiateInvoicePayment(token!, method);
      setPayStep("processing");
      // Refetch so the cached status becomes payment_processing, which starts
      // the polling loop that follows the payment through to completion.
      await refetch();
    } catch (err) {
      toast({
        title: "Payment not started",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStartingPayment(false);
    }
  };

  const handleRequestNewLink = async () => {
    if (requestingLink) return;
    setRequestingLink(true);
    try {
      await requestNewPaymentLinkRequest(token!);
      setLinkRequestState("sent");
    } catch (err) {
      toast({
        title: "Request not sent",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestingLink(false);
    }
  };

  // ─── Payer identification handlers ─────────────────────────────────────────

  const requestPin = async (email: string, isResend: boolean) => {
    setPinSending(true);
    setAuthError("");
    try {
      const result = await sendInvoiceClientPin(token!, email);
      setDevPin(result.devPin ?? "");
      setPinCooldown(result.resendAfterSeconds ?? 60);
      setPinCode("");
      setAuthStep("pin");
      toast({
        title: isResend ? "New PIN Sent" : "Verification PIN Sent",
        description: `A 6-digit PIN has been sent to ${email}. It expires in 10 minutes.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The PIN could not be sent.";
      setAuthError(message);
      toast({ title: "PIN Not Sent", description: message, variant: "destructive" });
    } finally {
      setPinSending(false);
    }
  };

  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy || pinSending) return;
    const email = payerEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    setPayerEmail(email);
    setAuthBusy(true);
    setAuthError("");
    try {
      const result = await checkEmailRegistered(email);
      if (result.registered) {
        setAuthStep("password");
      } else {
        await requestPin(email, false);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Could not check this email address.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLoginAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy || !loginPassword) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: payerEmail, password: loginPassword }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? "Invalid email or password");
      setAuthStep("identified");
      toast({ title: "Signed In", description: "You are verified. Please continue with your payment." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed.";
      setAuthError(message);
      toast({ title: "Sign In Failed", description: message, variant: "destructive" });
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePinVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinVerifying || pinCode.length !== 6) return;
    setPinVerifying(true);
    setAuthError("");
    try {
      await verifyInvoiceClientPin(token!, payerEmail, pinCode);
      toast({ title: "Email Verified", description: "Create your account to continue with the payment." });
      // Prefill the compact registration from the invoice client snapshot
      setVerifiedEmail(payerEmail);
      setRegFirstName(invoice.clientFirstName ?? "");
      setRegMiddleName(invoice.clientMiddleName ?? "");
      setRegLastName(invoice.clientLastName ?? "");
      setRegBusinessName(invoice.clientBusinessName ?? "");
      setRegBusinessRegNo("");
      setRegDirectorName("");
      setRegCountry("");
      setRegDob("");
      setRegGender("");
      setRegPhoneCode("");
      setRegPhoneNumber("");
      setRegPassword("");
      setRegConfirmPassword("");
      setAuthStep("register");
    } catch (err) {
      const message = err instanceof Error ? err.message : "The PIN could not be verified.";
      setAuthError(message);
      toast({ title: "Verification Failed", description: message, variant: "destructive" });
    } finally {
      setPinVerifying(false);
    }
  };

  const handleRegisterAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy) return;
    const isBusiness = invoice.clientType === "business";
    if (isBusiness && (!regBusinessName.trim() || !regBusinessRegNo.trim() || !regDirectorName.trim())) {
      setAuthError("Business name, registration number and director name are required.");
      return;
    }
    if (!isBusiness && (!regFirstName.trim() || !regLastName.trim())) {
      setAuthError("First name and last name are required.");
      return;
    }
    if (!regCountry) { setAuthError("Country is required."); return; }
    if (!regDob) { setAuthError("Date of birth is required."); return; }
    if (!regGender) { setAuthError("Gender is required."); return; }
    if (!regPhoneCode || regPhoneNumber.trim().length < 7) {
      setAuthError("A valid mobile number is required.");
      return;
    }
    if (!PASSWORD_RE.test(regPassword)) {
      setAuthError("Password must be at least 8 characters with 1 uppercase letter, 1 number and 1 special character.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accountType: isBusiness ? "business" : "individual",
          email: verifiedEmail,
          password: regPassword,
          confirmPassword: regConfirmPassword,
          country: regCountry,
          dateOfBirth: regDob,
          gender: regGender,
          mobileCode: regPhoneCode,
          mobileNumber: regPhoneNumber.trim(),
          ...(isBusiness
            ? {
                businessName: regBusinessName.trim(),
                businessRegNo: regBusinessRegNo.trim(),
                businessPhoneCode: regPhoneCode,
                businessPhoneNumber: regPhoneNumber.trim(),
                directorName: regDirectorName.trim(),
              }
            : {
                firstName: regFirstName.trim(),
                middleName: regMiddleName.trim(),
                lastName: regLastName.trim(),
              }),
          // Verified-payer registration: the invoice PIN session activates the
          // account and signs the payer in immediately.
          paymentRequestToken: token,
          isEmailLink: false,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? "Registration failed");
      setAuthStep("identified");
      toast({ title: "Account Created", description: "You are signed in. Please continue with your payment." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      setAuthError(message);
      toast({ title: "Registration Failed", description: message, variant: "destructive" });
    } finally {
      setAuthBusy(false);
    }
  };

  /** Forgot-password completion signs the payer in — continue the journey. */
  const handleForgotResetComplete = () => {
    setForgotPassword(false);
    setAuthStep("identified");
  };

  // ─── Status-specific states ────────────────────────────────────────────────

  if (status === "paid") {
    return (
      <Shell>
        <PaidCard invoiceNumber={invoice.invoiceNumber} alreadyPaid />
      </Shell>
    );
  }

  if (status === "cancelled") {
    const cancelledOn = invoice.cancelledAt ? formatHumanDate(invoice.cancelledAt.slice(0, 10)) : "";
    return (
      <Shell>
        <StatusCard
          icon={<XCircle className="w-8 h-8 text-red-600" />}
          title="Invoice Cancelled"
          testId="cancelled-invoice-card"
        >
          <p className="text-sm text-slate-700" data-testid="text-cancelled">
            This invoice was cancelled by the sender on {cancelledOn}.
          </p>
          {invoice.cancellationReason && (
            <p className="text-sm text-slate-700" data-testid="text-cancellation-reason">
              Reason: {invoice.cancellationReason}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Payment can no longer be made using this invoice link.
          </p>
        </StatusCard>
      </Shell>
    );
  }

  if (status === "expired") {
    const alreadyRequested = linkRequestState === "sent" || invoice.newLinkRequestedAt !== null;
    return (
      <Shell>
        <StatusCard
          icon={<Clock className="w-8 h-8 text-slate-600" />}
          title="Payment Link Expired"
          testId="expired-invoice-card"
        >
          <p className="text-sm text-slate-700" data-testid="text-expired">
            This payment link expired on {formatHumanDate(invoice.expiryDate)}. Please request a new payment link
            from {invoice.senderName}.
          </p>

          {alreadyRequested ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3" data-testid="request-sent-state">
              <p className="text-sm text-emerald-900 font-medium" data-testid="text-request-sent">
                Your request has been sent to the invoice sender.
              </p>
              <Button disabled className="mt-3 w-full" variant="outline" data-testid="button-request-sent">
                <Send className="w-4 h-4 mr-2" />
                Request Sent
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleRequestNewLink}
              disabled={requestingLink}
              className="mt-1 w-full bg-primary hover:bg-primary/90"
              data-testid="button-request-new-link"
            >
              {requestingLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Request New Payment Link
            </Button>
          )}
        </StatusCard>
      </Shell>
    );
  }

  if (status === "payment_processing" || payStep === "processing") {
    return (
      <Shell>
        <StatusCard
          icon={<Loader2 className="w-8 h-8 animate-spin text-purple-600" />}
          title="Payment Processing"
          testId="processing-card"
        >
          <p className="text-sm text-slate-700" data-testid="text-processing">
            Your payment for invoice {invoice.invoiceNumber} has been accepted and is being processed. This page
            will update automatically when the payment completes.
          </p>
          {invoice.paymentRef && (
            <p className="text-xs text-muted-foreground">Reference: {invoice.paymentRef}</p>
          )}
        </StatusCard>
      </Shell>
    );
  }

  // ─── Active (Sent / Overdue) — payment journey ─────────────────────────────

  const isOverdue = status === "overdue";

  const emailChip = (onChangeEmail: () => void) => (
    <div className="flex items-center justify-between gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg" data-testid="payer-email-chip">
      <span className="flex items-center gap-2 text-sm font-medium text-slate-800 min-w-0">
        <Mail className="w-4 h-4 text-blue-600 shrink-0" />
        <span className="truncate">{payerEmail}</span>
      </span>
      <button
        type="button"
        className="text-xs text-blue-600 font-medium hover:underline shrink-0"
        onClick={onChangeEmail}
        data-testid="button-change-email"
      >
        Change
      </button>
    </div>
  );

  const masterPasswordHint = (
    <p className="text-[11px] text-teal-700 font-mono" data-testid="master-password-hint">
      Development: any account also accepts the prototype master password {PROTOTYPE_MASTER_PASSWORD}.
    </p>
  );

  /** Identifier-first payer auth — shown until the payer has signed in or registered. */
  const identifyArea = () => {
    if (forgotPassword) {
      return (
        <div className="flex h-full flex-col" data-testid="payer-auth-forgot">
          <ForgotPassword
            initialEmail={payerEmail}
            onCancel={() => setForgotPassword(false)}
            onResetComplete={handleForgotResetComplete}
            cancelLabel="Back to payment"
            successToast={{
              title: "Password Successfully Reset",
              description: "Please continue your payment journey.",
            }}
          />
        </div>
      );
    }

    if (authStep === "email") {
      return (
        <div className="flex h-full flex-col" data-testid="payer-auth-email">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Secure checkout</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 font-display">Identify yourself to pay</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Enter your email address to continue. Registered emails sign in with a password; new emails are
              verified with a 6-digit PIN and registered.
            </p>
          </div>
          <form onSubmit={handleEmailCheck} className="mt-7 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="payer-email" className="text-xs font-medium">
                Your email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="payer-email"
                type="email"
                placeholder="you@example.com"
                value={payerEmail}
                onChange={(e) => setPayerEmail(e.target.value)}
                required
                autoFocus
                className="h-11"
                data-testid="input-payer-email"
              />
            </div>
            {authError && <p className="text-xs text-destructive" data-testid="error-auth">{authError}</p>}
            <Button type="submit" disabled={authBusy || pinSending} className="h-12 w-full bg-blue-600 hover:bg-blue-700" data-testid="button-check-email">
              {authBusy || pinSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Continue
            </Button>
          </form>
          {/* Prototype affordance: which email logs in vs registers */}
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3" data-testid="demo-login-hint">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center mb-1.5">Prototype tip</p>
            <p className="text-[11px] text-slate-500 text-center leading-5">
              Registered demo email —{" "}
              <span className="font-mono text-blue-600">{DEMO_PAYER_CREDENTIALS.email}</span> (password{" "}
              <span className="font-mono text-blue-600">{DEMO_PAYER_CREDENTIALS.password}</span>) logs straight in.
              Any other email verifies a PIN and registers a new payer.
            </p>
          </div>
          <p className="mt-auto pt-4 text-xs text-slate-500 leading-5">
            <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
            Rhemito never asks for your password or one-time codes by email or phone.
          </p>
        </div>
      );
    }

    if (authStep === "password") {
      return (
        <div className="flex h-full flex-col" data-testid="payer-auth-password">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Secure checkout</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 font-display">Sign in to pay</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This email is registered with Rhemito. Enter your password to continue with the payment.
            </p>
          </div>
          <form onSubmit={handleLoginAndContinue} className="mt-6 space-y-3">
            {emailChip(() => { setAuthStep("email"); setLoginPassword(""); setAuthError(""); })}
            <div className="space-y-1.5">
              <Label htmlFor="payer-password" className="text-xs font-medium">
                Password <span className="text-destructive">*</span>
              </Label>
              <PasswordInputWithToggle
                id="payer-password"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoFocus
                className="h-11"
                data-testid="input-payer-password"
              />
              <div className="text-right">
                <button
                  type="button"
                  className="text-xs text-blue-600 font-medium hover:underline"
                  onClick={() => setForgotPassword(true)}
                  data-testid="button-forgot-password"
                >
                  Forgot password?
                </button>
              </div>
              {masterPasswordHint}
            </div>
            {authError && <p className="text-xs text-destructive" data-testid="error-auth">{authError}</p>}
            <Button type="submit" disabled={authBusy || !loginPassword} className="h-12 w-full bg-blue-600 hover:bg-blue-700" data-testid="button-signin-pay">
              {authBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Sign In & Continue
            </Button>
          </form>
        </div>
      );
    }

    if (authStep === "pin") {
      return (
        <div className="flex h-full flex-col" data-testid="payer-auth-pin">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Verify your email</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 font-display">Enter the 6-digit PIN</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              We sent a PIN to your email address. Enter it below to verify this email and continue.
            </p>
          </div>
          <form onSubmit={handlePinVerify} className="mt-6 space-y-3">
            {emailChip(() => { setAuthStep("email"); setPinCode(""); setDevPin(""); setAuthError(""); })}
            {devPin && (
              <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2" data-testid="dev-pin-hint">
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">Prototype tip:</span> Use PIN{" "}
                  <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">{devPin}</span>
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pin-code" className="text-xs font-medium">
                6-digit PIN <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pin-code"
                type="text"
                maxLength={6}
                inputMode="numeric"
                placeholder="000000"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="h-11 text-center font-mono tracking-[0.5em]"
                data-testid="input-pin-code"
              />
            </div>
            {authError && <p className="text-xs text-destructive" data-testid="error-auth">{authError}</p>}
            <Button type="submit" disabled={pinVerifying || pinCode.length !== 6} className="h-12 w-full bg-blue-600 hover:bg-blue-700" data-testid="button-verify-pin">
              {pinVerifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Verify & Continue
            </Button>
            <div className="text-center">
              {pinCooldown > 0 ? (
                <p className="text-xs text-slate-400">
                  Didn't receive the PIN? Resend available in{" "}
                  <span className="font-mono font-medium">{pinCooldown}s</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Didn't receive the PIN?{" "}
                  <button
                    type="button"
                    onClick={() => requestPin(payerEmail, true)}
                    disabled={pinSending}
                    className="text-blue-600 font-medium hover:underline disabled:opacity-50"
                    data-testid="button-resend-pin"
                  >
                    {pinSending ? "Sending…" : "Resend"}
                  </button>
                </p>
              )}
            </div>
          </form>
        </div>
      );
    }

    // authStep === "register" — compact registration prefilled from the invoice
    const isBusiness = invoice.clientType === "business";
    return (
      <div className="flex h-full flex-col" data-testid="payer-auth-register">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Create your account</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 font-display">Register to pay</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your email is verified. Complete your {isBusiness ? "business" : ""} account details to continue with
            the payment.
          </p>
        </div>
        <form onSubmit={handleRegisterAndContinue} className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg" data-testid="payer-email-chip">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-800 min-w-0">
              <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{payerEmail}</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-medium shrink-0">
                Verified
              </Badge>
            </span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              <User className="w-3 h-3 mr-1" />
              {isBusiness ? "Business" : "Individual"}
            </Badge>
          </div>

          {isBusiness ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="reg-business-name" className="text-xs font-medium">
                  Business name <span className="text-destructive">*</span>
                </Label>
                <Input id="reg-business-name" value={regBusinessName} onChange={(e) => setRegBusinessName(e.target.value)} required className="h-11" data-testid="input-reg-business-name" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-business-regno" className="text-xs font-medium">
                    Registration no. <span className="text-destructive">*</span>
                  </Label>
                  <Input id="reg-business-regno" value={regBusinessRegNo} onChange={(e) => setRegBusinessRegNo(e.target.value)} required className="h-11" data-testid="input-reg-business-regno" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-director" className="text-xs font-medium">
                    Director name <span className="text-destructive">*</span>
                  </Label>
                  <Input id="reg-director" value={regDirectorName} onChange={(e) => setRegDirectorName(e.target.value)} required className="h-11" data-testid="input-reg-director" />
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-first-name" className="text-xs font-medium">
                  First name <span className="text-destructive">*</span>
                </Label>
                <Input id="reg-first-name" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} required className="h-11" data-testid="input-reg-first-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-middle-name" className="text-xs font-medium">Middle name</Label>
                <Input id="reg-middle-name" value={regMiddleName} onChange={(e) => setRegMiddleName(e.target.value)} className="h-11" data-testid="input-reg-middle-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-last-name" className="text-xs font-medium">
                  Last name <span className="text-destructive">*</span>
                </Label>
                <Input id="reg-last-name" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} required className="h-11" data-testid="input-reg-last-name" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Country <span className="text-destructive">*</span>
              </Label>
              <Select value={regCountry} onValueChange={(code) => {
                setRegCountry(code);
                const match = countries.find((c) => c.code === code);
                if (match) setRegPhoneCode(match.dialCode);
              }}>
                <SelectTrigger data-testid="select-register-country" className="h-11 bg-white">
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
            <div className="space-y-1.5">
              <Label htmlFor="reg-dob" className="text-xs font-medium">
                Date of birth <span className="text-destructive">*</span>
              </Label>
              <Input id="reg-dob" type="date" value={regDob} onChange={(e) => setRegDob(e.target.value)} required className="h-11" data-testid="input-reg-dob" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Gender <span className="text-destructive">*</span>
              </Label>
              <Select value={regGender} onValueChange={setRegGender}>
                <SelectTrigger data-testid="select-register-gender" className="h-11 bg-white">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {genderOptions.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Mobile number <span className="text-destructive">*</span>
              </Label>
              <PhoneInput
                codeValue={regPhoneCode}
                numberValue={regPhoneNumber}
                onCodeChange={setRegPhoneCode}
                onNumberChange={setRegPhoneNumber}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-password" className="text-xs font-medium">
              Password <span className="text-destructive">*</span>
            </Label>
            <PasswordInputWithToggle
              id="reg-password"
              placeholder="Create a password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              required
              className="h-11"
              data-testid="input-reg-password"
            />
            <p className="text-[11px] text-slate-400">
              At least 8 characters with 1 uppercase letter, 1 number and 1 special character.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-confirm-password" className="text-xs font-medium">
              Confirm password <span className="text-destructive">*</span>
            </Label>
            <PasswordInputWithToggle
              id="reg-confirm-password"
              placeholder="Re-enter your password"
              value={regConfirmPassword}
              onChange={(e) => setRegConfirmPassword(e.target.value)}
              required
              className="h-11"
              data-testid="input-reg-confirm-password"
            />
          </div>

          {authError && <p className="text-xs text-destructive" data-testid="error-auth">{authError}</p>}
          <Button type="submit" disabled={authBusy} className="h-12 w-full bg-blue-600 hover:bg-blue-700" data-testid="button-register-pay">
            {authBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <User className="w-4 h-4 mr-2" />}
            Create Account & Continue
          </Button>
        </form>
      </div>
    );
  };

  const payArea = () => {
    if (authStep !== "identified") {
      return identifyArea();
    }
    if (payStep === "landing") {
      return (
        <div className="flex flex-col">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Secure checkout</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 font-display">Complete your payment</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review the invoice details, then continue to choose how you would like to pay.
            </p>
          </div>

          <div className="mt-7 space-y-4">
          {isOverdue && (
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3" data-testid="overdue-banner">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                This invoice is overdue, but you can still make payment until {formatHumanDate(invoice.expiryDate)}.
              </p>
            </div>
          )}
          <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-4 py-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Protected by Rhemito</p>
              <p className="mt-1 text-sm text-slate-600 leading-6">
                Payments are processed securely. Start payment before {formatHumanDate(invoice.expiryDate)} at 11:59 p.m.
              </p>
            </div>
          </div>
          {invoice.source === "generated" && invoice.items && invoice.items.length > 0 ? (
            <GeneratedInvoiceDocument
                invoiceNumber={invoice.invoiceNumber}
                senderName={invoice.senderName}
                clientName={
                  invoice.clientType === "business"
                    ? (invoice.clientBusinessName ?? "")
                    : [invoice.clientFirstName, invoice.clientMiddleName, invoice.clientLastName]
                        .filter(Boolean)
                        .join(" ")
                }
                clientType={invoice.clientType}
                items={invoice.items}
                currency={invoice.currency}
                currencySymbol={sym}
                totals={invoice.totals ?? computeInvoiceTotals(invoice)}
                taxRate={invoice.taxRate}
                discountType={invoice.discountType}
                discountValue={invoice.discountValue}
                notes={invoice.notes}
                dueDate={invoice.dueDate}
                expiryDate={invoice.expiryDate}
                showPrintAction
              />
          ) : invoice.hasDocument && (
            <Button
              variant="outline"
              className="h-12 w-full justify-between border-slate-200 px-4 text-slate-800 hover:bg-slate-50"
              onClick={() => window.open(publicInvoiceDocumentUrl(token!), "_blank")}
              data-testid="button-view-invoice-document"
            >
              <span className="flex items-center gap-2.5"><FileText className="h-4 w-4 text-slate-500" />View invoice document</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Button>
          )}
          </div>
          <Button
            onClick={() => setPayStep("choose_method")}
            className="mt-6 h-14 w-full justify-between bg-blue-600 px-5 text-base hover:bg-blue-700"
            size="lg"
            data-testid="button-pay-invoice"
          >
            <span>Pay {sym}{invoice.fees.clientPays.toFixed(2)} {invoice.currency}</span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      );
    }

    if (payStep === "choose_method") {
      return (
        <div className="flex h-full flex-col" data-testid="payment-methods">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Payment method</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 font-display">How would you like to pay?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Choose a secure payment method to continue.</p>
          </div>
          <div className="mt-7 space-y-3">
          <button
            className="group w-full flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition-colors"
            onClick={() => handleInitiatePayment("card")}
            disabled={startingPayment}
            data-testid="button-pay-card"
          >
            <div className="w-11 h-11 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">Card Payment</p>
              <p className="mt-0.5 text-sm text-slate-500">Pay instantly by debit or credit card</p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-600" />
          </button>
          <button
            className="group w-full flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition-colors"
            onClick={() => handleInitiatePayment("bank_transfer")}
            disabled={startingPayment}
            data-testid="button-pay-bank"
          >
            <div className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">Bank Transfer</p>
              <p className="mt-0.5 text-sm text-slate-500">Pay directly from your bank account</p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-600" />
          </button>
          </div>
          <Button variant="ghost" className="mt-auto w-fit px-2 text-slate-600" onClick={() => setPayStep("landing")} data-testid="button-back-to-summary">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to summary
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <Shell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/40">
          <div className="grid min-h-[570px] md:grid-cols-[minmax(300px,5fr)_minmax(420px,7fr)]">
            {/* Summary panel */}
            <div className="p-7 md:p-10 bg-slate-900 text-white flex flex-col justify-between gap-8">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                  <FileText className="h-5 w-5 text-white/80" />
                </div>
                <p className="mt-6 text-xs font-semibold uppercase text-white/50">Invoice</p>
                <p className="text-2xl font-bold font-display mt-2 break-words" data-testid="public-invoice-number">{invoice.invoiceNumber}</p>
                <p className="text-sm text-white/60 mt-2">Issued by <span className="font-medium text-white/90">{invoice.senderName}</span></p>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium text-white/50">Invoice amount</p>
                  <p className="mt-1 text-lg font-semibold" data-testid="public-invoice-amount">
                    {sym}{invoice.fees.invoiceAmount.toFixed(2)} {invoice.currency}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-white/50">Total to pay, including fees</p>
                  <p className="mt-1 text-4xl font-bold text-emerald-400" data-testid="public-client-pays">
                    {sym}{invoice.fees.clientPays.toFixed(2)} {invoice.currency}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm border-t border-white/10 pt-5">
                {invoice.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Due Date</span>
                    <span className="font-medium text-right">{formatHumanDate(invoice.dueDate)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/60">Payment Link Expiry</span>
                  <span className="font-medium text-right">{formatHumanDate(invoice.expiryDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Status</span>
                  <span className="font-medium capitalize" data-testid="public-invoice-status">
                    {status === "payment_processing" ? "Payment Processing" : status}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment area */}
            <CardContent className="p-7 md:p-10">
              {payArea()}
            </CardContent>
          </div>
        </Card>
      </motion.div>
    </Shell>
  );
}

// ─── Layout & shared cards ────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f7fb] flex flex-col items-center justify-center px-4 py-8 md:px-8 md:py-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-blue-600/30 pointer-events-none" />
      <div className="w-full max-w-5xl mb-7 flex items-center justify-center md:justify-start relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
            <img src={logo} alt="Rhemito Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg md:text-xl font-bold text-slate-800 tracking-tight font-display">Rhemito</span>
        </div>
      </div>
      <div className="w-full max-w-5xl relative z-10">{children}</div>
    </div>
  );
}

function StatusCard({
  icon, title, testId, children,
}: {
  icon: React.ReactNode;
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div className="mx-auto max-w-md" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <Card className="border-border shadow-xl bg-white" data-testid={testId}>
        <div className="bg-slate-100/80 p-6 border-b border-border text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-inner">
            {icon}
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-display">{title}</h2>
        </div>
        <CardContent className="pt-6 pb-6 space-y-3">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PaidCard({ invoiceNumber, alreadyPaid }: { invoiceNumber: string; alreadyPaid?: boolean }) {
  return (
    <StatusCard
      icon={<CheckCircle2 className="w-8 h-8 text-emerald-600" />}
      title="Payment Complete"
      testId="paid-card"
    >
      <p className="text-sm text-slate-700" data-testid="text-paid">
        {alreadyPaid
          ? `Invoice ${invoiceNumber} has already been paid. Payment cannot be made again using this link.`
          : `Your payment for invoice ${invoiceNumber} was completed successfully.`}
      </p>
      <p className="text-xs text-muted-foreground">A confirmation has been sent to the invoice sender.</p>
    </StatusCard>
  );
}

function InvalidLinkCard() {
  return (
    <StatusCard icon={<Lock className="w-8 h-8 text-slate-600" />} title="Payment Link Not Valid" testId="invalid-link-card">
      <p className="text-sm text-slate-700">
        This invoice payment link does not exist or is no longer valid. Please check the link you received or
        contact the invoice sender.
      </p>
    </StatusCard>
  );
}
