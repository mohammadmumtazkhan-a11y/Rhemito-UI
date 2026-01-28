import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CreditCard, Building2, Calendar as CalendarIcon, ShieldCheck, ArrowRight, Wallet, Loader2, Copy, Mail, Lock, KeyRound, MapPin, User, Gift, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumDatePicker } from "@/components/ui/premium-date-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// @ts-ignore
import logo from "../assets/rhemito-logo-blue.png";
import { useToast } from "@/hooks/use-toast";

type AuthStep = "check_email" | "login" | "register_otp" | "register_password" | "register_address" | "mini_kyc_processing" | "payment" | "marketing";

export default function SenderView() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [authStep, setAuthStep] = useState<AuthStep>("check_email");
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [email, setEmail] = useState("name@example.com");
  const [isVerifiedSource, setIsVerifiedSource] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState<Date | undefined>(undefined);
  const [dobError, setDobError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [wasManualTransfer, setWasManualTransfer] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"method" | "card_details" | "processing_instant" | "manual_transfer" | "manual_transfer_complete">("method");

  const [countdown, setCountdown] = useState(5);

  // Mock Data

  const EXISTING_USER = "user@example.com";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "email") {
      setIsVerifiedSource(true);
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (authStep === "mini_kyc_processing") {
      timer = setTimeout(() => {
        setAuthStep("payment");
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [authStep]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPaid || paymentStep === "manual_transfer_complete") {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setAuthStep("marketing"); // Changed from setLocation("/marketing")
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPaid, paymentStep]);

  const requestDetails = {
    requesterName: "Olayinka Mamukuyomi",
    amountGBP: 100,
    amountNGN: 200000,
    reason: "Consulting services - Invoice #1234",
    date: "20 May, 2024",
    expiresIn: "2 days"
  };

  const handlePay = () => {
    setIsPaid(true);
    setPaymentStep("method");
  };

  const handleInstantPay = () => {
    setPaymentStep("processing_instant");
    setTimeout(() => {
      handlePay();
    }, 3000);
  };

  // Mock Scenarios for Demo
  const SCENARIOS = {
    EXISTING: "user@example.com",
    NEW_VERIFIED: "verified@example.com",
    NEW_UNVERIFIED: "whatsapp_user@example.com"
  };

  const checkEmail = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-fill names from email
    const namePart = email.split('@')[0];
    const parts = namePart.split(/[._]/);
    if (parts.length >= 2) {
      setFirstName(parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
      setLastName(parts[1].charAt(0).toUpperCase() + parts[1].slice(1));
    } else {
      setFirstName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
    }

    // Demo Routing Logic
    if (email === SCENARIOS.EXISTING) {
      // Scenario 1: Existing User -> Login
      setAuthStep("login");
      setIsExistingUser(true);
    }
    else if (email === SCENARIOS.NEW_VERIFIED) {
      // Scenario 2: New User coming from Email Link -> Skip OTP -> Create Password
      setIsExistingUser(false);
      setAuthStep("register_password");
    }
    else {
      // Scenario 3: Default / WhatsApp User -> OTP Required
      setIsExistingUser(false);
      setAuthStep("register_otp");
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStep("payment");
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStep("register_password");
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDobError("");

    if (!dob) {
      setDobError("Date of birth is required");
      return;
    }

    const today = new Date();
    const adultDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());

    if (dob > adultDate) {
      setDobError("You must be at least 18 years old to use Rhemito");
      return;
    }

    setAuthStep("mini_kyc_processing");
  };

  const PaymentMethodRow = ({
    icon: Icon,
    title,
    subtitle,
    onClick,
    isSelected = false
  }: {
    icon: any,
    title: string,
    subtitle: string,
    onClick: () => void,
    isSelected?: boolean
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 text-left group bg-white ${isSelected
        ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500"
        : "border-slate-200 hover:border-blue-500 hover:bg-slate-50 hover:shadow-md"
        }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected
        ? "bg-blue-100 text-blue-600"
        : "bg-slate-100/60 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 border border-slate-100"
        }`}>
        <Icon className="w-6 h-6" />
      </div>

      <div className="flex-1">
        <p className={`font-semibold text-base mb-0.5 ${isSelected ? "text-blue-700" : "text-slate-900 group-hover:text-blue-700"
          }`}>
          {title}
        </p>
        <p className={`text-sm ${isSelected ? "text-blue-600/80" : "text-slate-500"
          }`}>
          {subtitle}
        </p>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      {/* Logo Header */}
      <div className="w-full max-w-5xl mb-6 flex items-center justify-start relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
            <img src={logo} alt="Rhemito Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg md:text-xl font-bold text-slate-800 tracking-tight font-display">Rhemito</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl relative z-10"
      >
        <Card className="border-none shadow-xl shadow-slate-200/60 bg-white/80 backdrop-blur-xl">
          <div className="grid md:grid-cols-2">

            {/* Left Column: Payment Summary (Always Visible) */}
            <div className={`p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden flex flex-col justify-between hidden md:flex`}>

              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-x-20 -translate-y-20" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-x-20 translate-y-20" />

              <div className="relative z-10 space-y-8">
                <div>
                  <h1 className="text-2xl font-bold mb-2">Request Details</h1>
                  <p className="text-blue-200">Review the payment request details.</p>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold">
                    {requestDetails.requesterName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Requested By</p>
                    <p className="font-bold text-lg">{requestDetails.requesterName}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">You Pay</p>
                    <p className="text-5xl font-bold tracking-tight">£{requestDetails.amountGBP.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">They Receive</p>
                    <p className="text-2xl font-medium tracking-tight opacity-90">≈ ₦ {requestDetails.amountNGN.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-200">Payment For</span>
                    <span className="font-medium">{requestDetails.reason}</span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-auto pt-8">
                <div className="flex items-center gap-2 text-blue-200/80 text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Powered by Mito.Money</span>
                </div>
              </div>
            </div>


            {/* Right Column: Authentication / Payment Forms */}
            <div className="p-8 md:p-12">

              <AnimatePresence mode="wait">

                {/* Step 1: Check Email */}
                {authStep === 'check_email' && (
                  <motion.div
                    key="check_email"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-slate-900">Enter your email to pay</h2>
                      <p className="text-slate-500">We'll check if you have an account.</p>
                    </div>

                    <form onSubmit={checkEmail} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            className="pl-10 h-12"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg">Continue</Button>
                    </form>
                    <div className="text-xs text-center text-slate-400 space-y-1">
                      <p>Try <span className="font-mono bg-slate-100 px-1 rounded">user@example.com</span> for Existing User (Login)</p>
                      <p>Try <span className="font-mono bg-slate-100 px-1 rounded">verified@example.com</span> for New User via Email (Skip OTP)</p>
                      <p>Try <span className="font-mono bg-slate-100 px-1 rounded">whatsapp_user@example.com</span> for New User via WhatsApp (OTP)</p>
                    </div>
                  </motion.div>
                )}

                {/* Step 2a: Login (Existing User) */}
                {authStep === 'login' && (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-slate-900">Welcome back!</h2>
                      <p className="text-slate-500">Please enter your password to continue.</p>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                        {email.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-medium text-slate-900 truncate">{email}</p>
                        <p className="text-xs text-blue-600 cursor-pointer hover:underline" onClick={() => setAuthStep('check_email')}>Change account</p>
                      </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <a href="#" className="text-sm font-medium text-blue-600 hover:underline">Forgot password?</a>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                          <Input id="password" type="password" placeholder="••••••••" className="pl-10 h-12" required />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg">Log in and Pay</Button>
                    </form>
                  </motion.div>
                )}

                {/* Step 2b: Register OTP (New User) */}
                {authStep === 'register_otp' && (
                  <motion.div
                    key="register_otp"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-slate-900">Verify your email</h2>
                      <p className="text-slate-500">We've sent a code to <span className="font-semibold text-slate-900">{email}</span> <button type="button" className="text-blue-600 font-medium hover:underline text-sm ml-1" onClick={() => setAuthStep('check_email')}>Change email</button></p>
                    </div>

                    <form onSubmit={handleVerifyOTP} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="otp">Verification Code</Label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                          <Input id="otp" type="text" placeholder="123456" className="pl-10 h-12 tracking-widest text-lg" required />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg">Verify Code</Button>
                    </form>
                    <p className="text-sm text-center text-slate-500">
                      Didn't receive code? <button type="button" className="text-blue-600 font-medium hover:underline">Resend</button>
                    </p>
                  </motion.div>
                )}


                {/* Step 3: Create Password (Optional) */}
                <AnimatePresence>
                  {authStep === 'register_password' && (
                    <motion.div
                      key="register_password"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-slate-900">Create a Password</h2>
                        <p className="text-slate-500">
                          We will recognize you by your email ID. If you create a password, you may not need a Verification code next time.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <div className="relative">
                            <Input
                              id="new-password"
                              type="password"
                              placeholder="Min. 8 characters"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="pl-10"
                            />
                            <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <div className="relative">
                            <Input
                              id="confirm-password"
                              type="password"
                              placeholder="Re-enter password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="pl-10"
                            />
                            <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          </div>
                        </div>

                        <div className="pt-2 space-y-3">
                          <Button
                            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                            onClick={() => {
                              if (password) {
                                toast({
                                  title: "Password Created",
                                  description: "Your new password has been set successfully.",
                                  className: "bg-green-50 border-green-200 text-green-900"
                                });
                              }
                              setAuthStep("register_address");
                            }}
                          >
                            {password ? "Set Password & Continue" : "Continue"}
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full text-slate-500 hover:text-slate-900"
                            onClick={() => setAuthStep("register_address")}
                          >
                            Skip for now
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Step 3: Register Address (New User) */}
                {authStep === 'register_address' && (
                  <motion.div
                    key="register_address"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-slate-900">Where do you live?</h2>
                      <p className="text-slate-500">We need your address for secure payment processing.</p>
                    </div>

                    <form onSubmit={handleAddressSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            placeholder="e.g. Jane"
                            className="h-11"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            placeholder="e.g. Doe"
                            className="h-11"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 flex flex-col">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <PremiumDatePicker
                          date={dob}
                          setDate={setDob}
                        />
                        {dobError && (
                          <p className="text-sm text-red-500 font-medium animate-in fade-in slide-in-from-top-1">
                            {dobError}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input id="city" placeholder="London" className="h-11" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="postcode">Postcode</Label>
                          <Input id="postcode" placeholder="SW1A 1AA" className="h-11" required />
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 flex gap-3">
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <p>Your details are verified securely. We perform a quick background check to keep your money safe.</p>
                      </div>

                      <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg">Save & Continue</Button>
                    </form>
                  </motion.div>
                )}

                {/* Step 3b: Mini KYC Processing */}
                {authStep === 'mini_kyc_processing' && (
                  <motion.div
                    key="kyc"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-12 space-y-6 text-center"
                  >
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full border-4 border-slate-100" />
                      <Loader2 className="w-20 h-20 text-blue-600 animate-spin absolute top-0 left-0" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900">Verifying Details</h3>
                      <p className="text-slate-500 max-w-xs mx-auto">Please wait while we securely verify your information...</p>
                    </div>
                  </motion.div>
                )}



                {/* Step 4: Inline Payment Selection or Success */}
                {authStep === 'payment' && !isPaid && (
                  <motion.div
                    key="payment_inline"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2 mb-6">
                      <h2 className="text-2xl font-bold text-slate-900">
                        {paymentStep === "method" && "How would you like to pay?"}
                        {paymentStep === "card_details" && "Enter Card Details"}
                        {paymentStep === "processing_instant" && "Connecting to Bank"}
                        {paymentStep === "manual_transfer" && "Bank Transfer Details"}
                        {paymentStep === "manual_transfer_complete" && "Thank You"}
                      </h2>
                      <p className="text-slate-500">
                        {paymentStep === "method" && "Choose a secure payment method"}
                        {paymentStep === "card_details" && "We accept all major cards"}
                        {paymentStep === "processing_instant" && "This usually takes a few seconds"}
                        {paymentStep === "manual_transfer" && "Use these details to send money"}
                        {paymentStep === "manual_transfer_complete" && "We are verifying your transfer"}
                      </p>
                    </div>

                    <div className="pt-2">
                      {paymentStep === "method" ? (
                        <div className="space-y-3">
                          <PaymentMethodRow
                            icon={Building2}
                            title="Instant Pay By Bank"
                            subtitle={`You pay GBP ${requestDetails.amountGBP.toFixed(2)}`}
                            onClick={handleInstantPay}
                          />

                          <PaymentMethodRow
                            icon={CreditCard}
                            title="Credit/Debit Card"
                            subtitle={`You pay GBP ${requestDetails.amountGBP.toFixed(2)}`}
                            onClick={() => setPaymentStep("card_details")}
                          />

                          <PaymentMethodRow
                            icon={Building2}
                            title="Manual Bank Transfer"
                            subtitle="Send to our local account"
                            onClick={() => setPaymentStep("manual_transfer")}
                          />

                          {isExistingUser && (
                            <PaymentMethodRow
                              icon={Wallet}
                              title="Wallet Balance"
                              subtitle="Available: GBP 300.20"
                              onClick={handlePay}
                            />
                          )}
                        </div>
                      ) : paymentStep === "processing_instant" ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-slate-100" />
                            <Loader2 className="w-16 h-16 text-blue-600 animate-spin absolute top-0 left-0" />
                          </div>
                          <div className="text-center space-y-1">
                            <h3 className="font-semibold text-lg text-slate-900">Processing Payment</h3>
                            <p className="text-slate-500 text-sm">Securely connecting to your bank...</p>
                          </div>
                        </div>
                      ) : paymentStep === "manual_transfer" ? (
                        <div className="space-y-6">
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                            <p className="text-sm text-blue-700 font-medium">
                              An email has been sent to your email ID <span className="font-bold">{email}</span> containing the Beneficiary Bank Details.
                            </p>
                            <p className="text-sm text-blue-700 font-medium">Please transfer exactly <span className="font-bold">£{requestDetails.amountGBP.toFixed(2)}</span> to the details below:</p>

                            <div className="space-y-4 pt-2">
                              <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                                <span className="text-sm text-slate-500">Bank Name</span>
                                <span className="font-semibold text-slate-900">Rhemito Ltd</span>
                              </div>
                              <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                                <span className="text-sm text-slate-500">Sort Code</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">12-34-56</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-100"><Copy className="w-3.5 h-3.5" /></Button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                                <span className="text-sm text-slate-500">Account Number</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">12345678</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-100"><Copy className="w-3.5 h-3.5" /></Button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Reference</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 bg-blue-100 px-2 py-0.5 rounded">REF12345</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-100"><Copy className="w-3.5 h-3.5" /></Button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              className="flex-1 h-12"
                              onClick={() => setPaymentStep("method")}
                            >
                              Back
                            </Button>
                            <Button
                              className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                              onClick={() => {
                                setWasManualTransfer(true);
                                setPaymentStep("manual_transfer_complete");
                              }}
                            >
                              I have sent it
                            </Button>
                          </div>
                        </div>

                      ) : paymentStep === "manual_transfer_complete" ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10 text-blue-600" />
                          </div>
                          <div className="space-y-2 px-6">
                            <h3 className="text-xl font-bold text-slate-900">Transfer Initiated</h3>
                            <p className="text-slate-500">
                              Thank you. We will verify your transfer shortly and notify you via email once completed.
                            </p>
                          </div>

                          <div className="space-y-2 pt-2">
                            <p className="text-sm font-medium text-blue-600 animate-pulse">
                              Redirecting you to exclusive offers in {countdown}s...
                            </p>
                            <div className="h-1 w-24 bg-slate-100 rounded-full mx-auto overflow-hidden">
                              <div
                                className="h-full bg-blue-600 transition-all duration-1000 ease-linear"
                                style={{ width: `${(countdown / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="w-full max-w-[200px]"
                            onClick={() => {
                              setPaymentStep("method");
                            }}
                          >
                            Back to Methods
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-6 pt-2">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="cardNumber">Card Number</Label>
                              <Input
                                id="cardNumber"
                                placeholder="0000 0000 0000 0000"
                                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                data-testid="input-card-number"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="expiry">Expiry Date</Label>
                                <Input
                                  id="expiry"
                                  placeholder="MM / YY"
                                  className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                  data-testid="input-card-expiry"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="cvv">CVC / CVC</Label>
                                <Input
                                  id="cvv"
                                  placeholder="123"
                                  className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                  data-testid="input-card-cvv"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="name">Cardholder Name</Label>
                              <Input
                                id="name"
                                placeholder="e.g. John Doe"
                                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                data-testid="input-card-name"
                              />
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              className="flex-1 h-12"
                              onClick={() => setPaymentStep("method")}
                            >
                              Back
                            </Button>
                            <Button
                              className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                              onClick={handlePay}
                              data-testid="button-confirm-card-payment"
                            >
                              Pay ₦{requestDetails.amountNGN.toLocaleString()}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Payment Success (Inline) */}
                {authStep === 'payment' && isPaid && (
                  <motion.div
                    key="payment_success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-12 space-y-6 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                      className="w-20 h-20 bg-teal/10 rounded-full flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-10 h-10 text-teal" />
                    </motion.div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-slate-900">Payment Successful</h2>
                      <p className="text-slate-500">
                        You've successfully sent <span className="font-semibold text-slate-900">₦{requestDetails.amountNGN.toLocaleString()}</span> to {requestDetails.requesterName}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-500 border border-slate-100">
                      <p>A receipt has been sent to your email.</p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="transparent"
                            className="text-slate-100"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="transparent"
                            strokeDasharray={175.93}
                            strokeDashoffset={175.93 - (175.93 * countdown) / 5}
                            className="text-blue-600 transition-all duration-1000 ease-linear"
                          />
                        </svg>
                        <span className="absolute text-xl font-bold text-blue-600">{countdown}</span>
                      </div>
                      <p className="text-sm font-medium text-blue-600 animate-pulse">
                        Redirecting to exclusive offers...
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full rounded-full h-12 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      onClick={() => window.close()}
                    >
                      Close Window
                    </Button>
                  </motion.div>
                )}

                {/* Step 6: Inline Marketing/Offers */}
                {authStep === 'marketing' && (
                  <motion.div
                    key="marketing"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {/* Success/Pending Banner */}
                    {wasManualTransfer ? (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                          <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                        </div>
                        <div>
                          <p className="font-bold text-amber-900 text-sm">Transfer Pending Verification</p>
                          <p className="text-amber-700 text-xs">We'll notify you once your transfer is confirmed</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-bold text-emerald-900 text-sm">Payment Successful!</p>
                          <p className="text-emerald-700 text-xs">Your transaction has been completed securely</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 mb-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
                        <Star className="w-3 h-3 fill-blue-600" />
                        <span>Exclusive Offers</span>
                      </div>
                      <h2 className="text-2xl font-bold text-slate-900">Special Offers for You</h2>
                      <p className="text-slate-500">Take advantage of these premium benefits</p>
                    </div>

                    <div className="space-y-4">
                      {/* Offer 1: First Transfer Free */}
                      <div className="group relative bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl shadow-xl shadow-blue-900/20 hover:shadow-2xl hover:shadow-blue-900/30 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl translate-x-8 -translate-y-8" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/30 rounded-full blur-xl -translate-x-8 translate-y-8" />

                        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-[10px] px-2 py-1 rounded-full uppercase tracking-wider animate-pulse">
                          New Users
                        </div>

                        <div className="relative z-10 flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0 group-hover:bg-white/30 transition-colors">
                            <Gift className="w-6 h-6 drop-shadow-md" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">First Transfer Free</h3>
                            <p className="text-blue-100 text-sm leading-relaxed mb-4 opacity-90 font-medium">
                              Send up to £500 with absolutely <span className="text-white font-bold underline decoration-blue-300/50 underline-offset-2">zero fees</span>. Experience our premium speed.
                            </p>
                            <a href="https://www.rhemito.com/login">
                              <Button className="bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-full h-10 px-5 text-sm shadow-lg shadow-black/10 transition-all group-hover:scale-105">
                                Claim Offer <ArrowRight className="w-4 h-4 ml-1" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Offer 2: Best Rate Guarantee */}
                      <div className="group relative bg-white/60 backdrop-blur-xl border border-white/60 hover:border-teal/30 p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                            <ShieldCheck className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Best Rate Guarantee</h3>
                            <p className="text-slate-600 text-sm leading-relaxed mb-4">
                              Find a better rate? We'll <span className="font-bold text-teal-700">match it</span> and credit your account with £5.
                            </p>
                            <a href="https://www.rhemito.com/login" className="inline-flex items-center gap-2 text-teal-700 font-bold text-sm group/link hover:text-teal-800 transition-colors">
                              <span>See Details</span>
                              <div className="w-6 h-6 rounded-full bg-teal/10 flex items-center justify-center group-hover/link:bg-teal/20 transition-colors">
                                <ArrowRight className="w-3 h-3" />
                              </div>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Trust Badges */}
                      <div className="flex items-center justify-center gap-6 pt-4 opacity-70">
                        <div className="flex items-center gap-2 text-slate-600">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">FCA Regulated</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Zap className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Instant Transfers</span>
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="pt-2">
                        <a href="https://www.rhemito.com/login" className="w-full block">
                          <Button size="lg" className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-xl shadow-blue-600/30 transition-all hover:-translate-y-0.5">
                            Open Free Account
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </Card>
      </motion.div>


    </div >
  );
}
