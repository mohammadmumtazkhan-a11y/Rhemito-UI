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
  HelpCircle,
  CreditCard,
  ChevronDown,
  ArrowRightLeft
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { knownSenders, type KnownSender } from "@/data/knownSenders";
import { payoutAccounts, getDefaultPayoutAccount, type PayoutAccount } from "@/data/payoutAccounts";

const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  GBP: { NGN: 2000, USD: 1.27, EUR: 1.17, GBP: 1 },
  USD: { NGN: 1575, GBP: 0.79, EUR: 0.92, USD: 1 },
  EUR: { NGN: 1712, GBP: 0.85, USD: 1.09, EUR: 1 },
  NGN: { GBP: 0.0005, USD: 0.00063, EUR: 0.00058, NGN: 1 },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

interface FormData {
  requestAmount: string;
  senderCurrency: string;
  selectedPayoutAccountId: string;
  paymentMethod: string;
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
}

const COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+1", country: "Canada", flag: "🇨🇦" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
];

const steps = [
  { id: 1, title: "Amount & Currencies", description: "Set amount & payout destination" },
  { id: 2, title: "Sender Information", description: "Who's paying you?" },
  { id: 3, title: "Review & Confirm", description: "Verify details & send" },
];

export default function RequestPayment() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [senderSearch, setSenderSearch] = useState("");
  const [showSenderSuggestions, setShowSenderSuggestions] = useState(false);
  const [isChangingPayoutAccount, setIsChangingPayoutAccount] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const availablePayoutAccounts = useMemo(() => payoutAccounts.filter(a => a.activated), []);
  const defaultAccount = useMemo(() => getDefaultPayoutAccount() || availablePayoutAccounts[0], [availablePayoutAccounts]);

  const [formData, setFormData] = useState<FormData>({
    requestAmount: "",
    senderCurrency: "GBP",
    selectedPayoutAccountId: defaultAccount ? defaultAccount.id : "",
    paymentMethod: "sender_choice",
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
  });

  // Ensure default payout account is selected on load
  useEffect(() => {
    if (!formData.selectedPayoutAccountId && defaultAccount) {
      setFormData(prev => ({ ...prev, selectedPayoutAccountId: defaultAccount.id }));
    }
  }, [defaultAccount, formData.selectedPayoutAccountId]);

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

  const selectedPayoutAccount: PayoutAccount | undefined = useMemo(() => {
    return availablePayoutAccounts.find(a => a.id === formData.selectedPayoutAccountId) || defaultAccount;
  }, [availablePayoutAccounts, formData.selectedPayoutAccountId, defaultAccount]);

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

  const getExchangeRate = () => {
    if (senderCurrency === payoutCurrency) return 1;
    return EXCHANGE_RATES[senderCurrency]?.[payoutCurrency] || 1;
  };

  const parsedAmount = parseFloat(formData.requestAmount) || 0;
  const platformFeeRate = 0.03; // 3% fee absorbed by requester
  const platformFeeAmount = parsedAmount * platformFeeRate;
  const netBeforeFx = parsedAmount - platformFeeAmount;
  const fxRate = getExchangeRate();
  const netPayoutAmount = netBeforeFx * fxRate;

  const senderSymbol = CURRENCY_SYMBOLS[senderCurrency] || "";
  const payoutSymbol = CURRENCY_SYMBOLS[payoutCurrency] || "";

  const paymentLink = useMemo(() => `rhemito.com/pay/ref${Math.random().toString(36).substring(2, 8)}`, []);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsSuccess(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setLocation("/");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${paymentLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return parsedAmount > 0 && !!selectedPayoutAccount;
      case 2:
        return !!formData.senderEmail && (formData.senderType === "individual" ? !!formData.senderFirstName : !!formData.senderBusinessName);
      case 3:
        return true;
      default:
        return false;
    }
  };

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
                <h2 className="text-2xl font-bold font-display text-slate-900">Payment Request Ready!</h2>
                <p className="text-sm text-muted-foreground">
                  A payment link has been created for{" "}
                  <span className="font-semibold text-foreground">
                    {formData.senderType === "business"
                      ? formData.senderBusinessName
                      : [formData.senderFirstName, formData.senderMiddleName, formData.senderLastName].filter(Boolean).join(" ")}
                  </span>
                </p>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl space-y-2 text-left border border-border">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Requested Amount (Sender Pays):</span>
                  <span className="font-medium text-foreground">{senderSymbol}{parsedAmount.toFixed(2)} {senderCurrency}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fee Absorbed (3%):</span>
                  <span className="font-medium text-foreground">-{senderSymbol}{platformFeeAmount.toFixed(2)} {senderCurrency}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-border/60">
                  <span className="text-primary">You Receive in Bank:</span>
                  <span className="text-primary font-bold">{payoutSymbol}{netPayoutAmount.toFixed(2)} {payoutCurrency}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Payout to: {selectedPayoutAccount?.bank} (****{selectedPayoutAccount?.accountNumber.slice(-4)})
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary/5 to-teal/5 rounded-xl p-4 space-y-3 border border-primary/10">
                <p className="text-xs font-medium text-slate-700">Share this link directly with your sender:</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={`https://${paymentLink}`}
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
                      selectedPayoutAccountId: defaultAccount ? defaultAccount.id : "",
                      paymentMethod: "sender_choice",
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
                    });
                    setCurrentStep(1);
                    setIsSuccess(false);
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

          <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900">Request Payment</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Request money from customers or clients worldwide with instant payout</p>
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

                      {/* Zero Payout Account Prompt (Option A) */}
                      {availablePayoutAccounts.length === 0 ? (
                        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-amber-900">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-sm">Payout Account Required</h4>
                              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                                You need an active payout bank account before you can request payments and receive funds.
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => setLocation("/payout-accounts")}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs h-9"
                          >
                            Add Payout Bank Account
                          </Button>
                        </div>
                      ) : (
                        /* Default Payout Account Card */
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Receiving Payout Account</span>
                              {selectedPayoutAccount?.isDefault && (
                                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary hover:bg-primary/10">
                                  Default
                                </Badge>
                              )}
                            </div>
                            {availablePayoutAccounts.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsChangingPayoutAccount(!isChangingPayoutAccount)}
                                className="text-xs text-primary h-7 px-2"
                              >
                                {isChangingPayoutAccount ? "Done" : "Change"}
                              </Button>
                            )}
                          </div>

                          {!isChangingPayoutAccount ? (
                            <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-foreground truncate">{selectedPayoutAccount?.bank}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  ****{selectedPayoutAccount?.accountNumber.slice(-4)} • {selectedPayoutAccount?.name}
                                </p>
                              </div>
                              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 font-semibold text-xs shrink-0">
                                {payoutCurrency}
                              </Badge>
                            </div>
                          ) : (
                            <div className="space-y-2 pt-1">
                              {availablePayoutAccounts.map((acc) => (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange("selectedPayoutAccountId", acc.id);
                                    setIsChangingPayoutAccount(false);
                                  }}
                                  className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                                    formData.selectedPayoutAccountId === acc.id
                                      ? "border-primary bg-primary/5"
                                      : "border-border bg-white hover:border-primary/40"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div className="truncate text-xs">
                                      <span className="font-semibold">{acc.bank}</span> (****{acc.accountNumber.slice(-4)})
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-bold text-slate-600">{acc.currency}</span>
                                    {formData.selectedPayoutAccountId === acc.id && (
                                      <Check className="w-4 h-4 text-primary" />
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
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
                                className="pl-8 text-xl md:text-2xl font-bold h-12 md:h-14 bg-white shadow-sm"
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
                                <SelectItem value="GBP">GBP (£)</SelectItem>
                                <SelectItem value="USD">USD ($)</SelectItem>
                                <SelectItem value="EUR">EUR (€)</SelectItem>
                                <SelectItem value="NGN">NGN (₦)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            The sender will be billed in <strong>{senderCurrency}</strong>.
                          </p>
                        </div>
                      </div>

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
                            <span className="font-bold text-slate-800">
                              {senderSymbol}{parsedAmount.toFixed(2)} {senderCurrency}
                            </span>
                          </div>

                          <div className="flex justify-between text-muted-foreground">
                            <span>Fee (3% absorbed by you):</span>
                            <span className="font-medium text-red-600">
                              -{senderSymbol}{platformFeeAmount.toFixed(2)} {senderCurrency}
                            </span>
                          </div>

                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Net before FX:</span>
                            <span>{senderSymbol}{netBeforeFx.toFixed(2)} {senderCurrency}</span>
                          </div>

                          {senderCurrency !== payoutCurrency && (
                            <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              <span className="text-muted-foreground">FX Rate:</span>
                              <span className="font-semibold text-slate-800">
                                1 {senderCurrency} = {payoutSymbol}{fxRate.toLocaleString()} {payoutCurrency}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="h-px bg-border" />

                        <div className="bg-primary/5 -mx-5 px-5 py-3.5 -mb-5 rounded-b-xl border-t border-primary/15">
                          <p className="text-xs text-muted-foreground mb-0.5">You Receive in Bank:</p>
                          <div className="flex items-baseline justify-between">
                            <span className="text-xl md:text-2xl font-extrabold text-primary">
                              {payoutSymbol}{netPayoutAmount.toFixed(2)}
                            </span>
                            <span className="text-xs font-bold text-primary">{payoutCurrency}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Deposited to {selectedPayoutAccount?.bank || "Default Account"}
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
                          onClick={() => handleInputChange("senderType", "business")}
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
                          <SelectTrigger className="w-32" data-testid="select-country-code">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map((country, index) => (
                              <SelectItem key={`${country.code}-${index}`} value={country.code}>
                                {country.flag} {country.code}
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

                    {/* Reason for Payment (Optional) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="reason" className="text-xs font-medium">Reason for Payment</Label>
                        <span className="text-[11px] text-muted-foreground">Optional</span>
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
                  </div>
                )}

                {/* ================= STEP 3: REVIEW & CONFIRM ================= */}
                {currentStep === 3 && (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 md:p-6 space-y-5">
                      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold">Sender Pays</p>
                          <p className="text-2xl font-bold text-slate-900 mt-0.5">
                            {senderSymbol}{parsedAmount.toFixed(2)} {senderCurrency}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold">You Receive in Bank</p>
                          <p className="text-2xl font-bold text-primary mt-0.5">
                            {payoutSymbol}{netPayoutAmount.toFixed(2)} {payoutCurrency}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-muted-foreground">Platform Fee (3% absorbed):</span>
                          <span className="font-medium text-red-600">-{senderSymbol}{platformFeeAmount.toFixed(2)} {senderCurrency}</span>
                        </div>

                        {senderCurrency !== payoutCurrency && (
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-muted-foreground">Exchange Rate:</span>
                            <span className="font-medium">1 {senderCurrency} = {payoutSymbol}{fxRate.toLocaleString()} {payoutCurrency}</span>
                          </div>
                        )}

                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-muted-foreground">Destination Payout Account:</span>
                          <span className="font-semibold text-slate-800">
                            {selectedPayoutAccount?.bank} (****{selectedPayoutAccount?.accountNumber.slice(-4)})
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

                        {formData.senderDob && (
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-muted-foreground">Sender DOB:</span>
                            <span className="font-medium">{formData.senderDob}</span>
                          </div>
                        )}

                        {formData.reason && (
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-muted-foreground">Reason:</span>
                            <span className="font-medium capitalize">{formData.reason.replace(/_/g, " ")}</span>
                          </div>
                        )}

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
    </DashboardLayout>
  );
}
