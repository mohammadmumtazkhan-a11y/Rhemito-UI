import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Copy, AlertTriangle, CheckCircle2, Search, User, Building2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { knownSenders, type KnownSender } from "@/data/knownSenders";
import { payoutAccounts, getPayoutAccountByCurrency } from "@/data/payoutAccounts";

const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  GBP: { NGN: 2000, USD: 1.27, EUR: 1.17 },
  USD: { NGN: 1575, GBP: 0.79, EUR: 0.92 },
  EUR: { NGN: 1712, GBP: 0.85, USD: 1.09 },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

interface FormData {
  receiveAmount: string;
  receiveCurrency: string;
  senderCurrency: string;
  paymentMethod: string;
  senderFirstName: string;
  senderMiddleName: string;
  senderLastName: string;
  senderEmail: string;
  senderCountryCode: string;
  senderPhone: string;
  senderDob: string;
  reason: string;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  selectedPayoutAccountId: string;
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

const initialFormData: FormData = {
  receiveAmount: "",
  receiveCurrency: "GBP",
  senderCurrency: "NGN",
  paymentMethod: "sender_choice",
  senderFirstName: "",
  senderMiddleName: "",
  senderLastName: "",
  senderEmail: "",
  senderCountryCode: "+44",
  senderPhone: "",
  senderDob: "",
  reason: "",
  bankAccountName: "",
  bankSortCode: "",
  bankAccountNumber: "",
  selectedPayoutAccountId: "",
};

const steps = [
  { id: 1, title: "Payout Account", description: "Where to receive funds" },
  { id: 2, title: "Transaction Details", description: "Set amount and method" },
  { id: 3, title: "Sender Information", description: "Who's paying you?" },
  { id: 4, title: "Review & Confirm", description: "Verify details" },
];

export default function RequestPayment() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [senderSearch, setSenderSearch] = useState("");
  const [showSenderSuggestions, setShowSenderSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredSenders = knownSenders.filter(sender => {
    const fullName = `${sender.firstName} ${sender.middleName} ${sender.lastName}`.toLowerCase();
    const searchLower = senderSearch.toLowerCase();
    return fullName.includes(searchLower) || sender.email.toLowerCase().includes(searchLower);
  });

  const selectKnownSender = (sender: KnownSender) => {
    setFormData(prev => ({
      ...prev,
      senderFirstName: sender.firstName,
      senderMiddleName: sender.middleName,
      senderLastName: sender.lastName,
      senderEmail: sender.email,
      senderCountryCode: sender.countryCode,
      senderPhone: sender.phone,
      senderDob: sender.dob,
    }));
    setSenderSearch("");
    setShowSenderSuggestions(false);
  };

  const selectedPayoutAccount = payoutAccounts.find(a => a.id === formData.selectedPayoutAccountId);
  const availablePayoutAccounts = payoutAccounts.filter(a => a.activated);

  useEffect(() => {
    if (formData.selectedPayoutAccountId) {
      const account = payoutAccounts.find(a => a.id === formData.selectedPayoutAccountId);
      if (account) {
        setFormData(prev => ({ ...prev, receiveCurrency: account.currency }));
      }
    }
  }, [formData.selectedPayoutAccountId]);

  const getExchangeRate = () => {
    const { receiveCurrency, senderCurrency } = formData;
    if (receiveCurrency === senderCurrency) return 1;
    return EXCHANGE_RATES[receiveCurrency]?.[senderCurrency] || 1;
  };

  const senderPays = formData.receiveAmount 
    ? (parseFloat(formData.receiveAmount) * getExchangeRate()).toLocaleString()
    : "0";

  const receiveSymbol = CURRENCY_SYMBOLS[formData.receiveCurrency] || "";
  const senderSymbol = CURRENCY_SYMBOLS[formData.senderCurrency] || "";

  const paymentLink = `rhemito.com/pay/ref${Math.random().toString(36).substring(2, 8)}`;

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < 4) {
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
        return formData.selectedPayoutAccountId;
      case 2:
        return formData.receiveAmount;
      case 3:
        return formData.senderFirstName && formData.senderEmail;
      case 4:
        return true;
      default:
        return false;
    }
  };

  if (isSuccess) {
    return (
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto mt-12"
        >
          <Card className="text-center">
            <CardContent className="pt-12 pb-8 space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 bg-teal rounded-full flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-display">Payment Request Sent!</h2>
                <p className="text-muted-foreground">
                  Successfully sent to <span className="font-medium text-foreground">{[formData.senderFirstName, formData.senderMiddleName, formData.senderLastName].filter(Boolean).join(" ")}</span>
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground">Share this link with your sender:</p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={`https://${paymentLink}`} 
                    readOnly 
                    className="text-sm bg-white"
                    data-testid="input-payment-link"
                  />
                  <Button 
                    onClick={handleCopyLink}
                    variant="outline"
                    className="shrink-0"
                    data-testid="button-copy-link"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
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
                    setFormData(initialFormData);
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
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-4 -ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-2xl font-bold font-display">Request Payment</h1>
          <p className="text-muted-foreground mt-1">Get paid by generating a payment link</p>
        </motion.div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: currentStep >= step.id ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    color: currentStep >= step.id ? "white" : "hsl(var(--muted-foreground))",
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                >
                  {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                </motion.div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-4 ${currentStep > step.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="font-display">{steps[currentStep - 1].title}</CardTitle>
                <CardDescription>{steps[currentStep - 1].description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-primary/5 to-teal/5 rounded-xl p-6">
                      <h3 className="font-semibold mb-4">Select your payout account</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Choose the bank account where you want to receive the funds. You can only have one account per currency.
                      </p>
                      
                      <div className="grid gap-3">
                        {availablePayoutAccounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => handleInputChange("selectedPayoutAccountId", account.id)}
                            className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 text-left ${
                              formData.selectedPayoutAccountId === account.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 bg-white"
                            }`}
                            data-testid={`payout-account-${account.id}`}
                          >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              formData.selectedPayoutAccountId === account.id ? "bg-primary text-white" : "bg-muted"
                            }`}>
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{account.bank}</p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{account.currency}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                ****{account.accountNumber.slice(-4)} • {account.name}
                              </p>
                            </div>
                            {formData.selectedPayoutAccountId === account.id && (
                              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>

                      {availablePayoutAccounts.length === 0 && (
                        <div className="text-center py-8">
                          <Building2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-muted-foreground mb-4">No payout accounts set up yet</p>
                          <Button variant="outline" onClick={() => setLocation("/payout-accounts")}>
                            Add Payout Account
                          </Button>
                        </div>
                      )}
                    </div>

                    {selectedPayoutAccount && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">
                          <strong>Selected:</strong> {selectedPayoutAccount.bank} ({selectedPayoutAccount.currency}) - ****{selectedPayoutAccount.accountNumber.slice(-4)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-6">
                      <div className="bg-gradient-to-br from-primary/5 to-teal/5 rounded-xl p-6 space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="receiveAmount" className="text-sm font-medium">
                            I want to receive
                          </Label>
                          <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">{receiveSymbol}</span>
                              <Input
                                id="receiveAmount"
                                type="number"
                                placeholder="0.00"
                                value={formData.receiveAmount}
                                onChange={(e) => handleInputChange("receiveAmount", e.target.value)}
                                className="pl-8 text-2xl font-bold h-14 bg-white"
                                data-testid="input-receive-amount"
                              />
                            </div>
                            <Select
                              value={formData.receiveCurrency}
                              onValueChange={(value) => handleInputChange("receiveCurrency", value)}
                            >
                              <SelectTrigger className="w-24 h-14 bg-white font-medium" data-testid="select-receive-currency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GBP">GBP</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="h-px bg-border" />

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">
                            Sender pays (at 1 {formData.receiveCurrency} = {senderSymbol}{getExchangeRate().toLocaleString()})
                          </Label>
                          <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-teal">{senderSymbol}</span>
                              <div className="pl-8 text-2xl font-bold h-14 bg-teal/10 rounded-lg flex items-center text-teal border border-teal/20">
                                {senderPays}
                              </div>
                            </div>
                            <Select
                              value={formData.senderCurrency}
                              onValueChange={(value) => handleInputChange("senderCurrency", value)}
                            >
                              <SelectTrigger className="w-24 h-14 bg-teal/10 border-teal/20 font-medium text-teal" data-testid="select-sender-currency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NGN">NGN</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="GBP">GBP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="paymentMethod">Payment Method (Optional)</Label>
                        <Select
                          value={formData.paymentMethod}
                          onValueChange={(value) => handleInputChange("paymentMethod", value)}
                        >
                          <SelectTrigger id="paymentMethod" data-testid="select-payment-method">
                            <SelectValue placeholder="How will the sender pay?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sender_choice">Let the Sender Choose</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="card">Card Payment</SelectItem>
                            <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="lg:col-span-2 lg:self-start lg:sticky lg:top-6">
                      <div className="border-2 border-primary/20 rounded-xl p-5 space-y-4 bg-white" data-testid="fee-breakdown">
                        <h3 className="font-semibold text-lg">Amount</h3>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">You Request</span>
                            <span className="font-medium">
                              {formData.receiveAmount && parseFloat(formData.receiveAmount) > 0 
                                ? `${receiveSymbol}${parseFloat(formData.receiveAmount).toFixed(2)} ${formData.receiveCurrency}`
                                : `0.00 ${formData.receiveCurrency}`}
                            </span>
                          </div>
                          
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Fee (3%)</span>
                            <span className="font-medium">
                              {formData.receiveAmount && parseFloat(formData.receiveAmount) > 0 
                                ? `${senderSymbol}${(parseFloat(formData.receiveAmount) * getExchangeRate() * 0.03).toFixed(2)} ${formData.senderCurrency}`
                                : `0.00 ${formData.senderCurrency}`}
                            </span>
                          </div>
                          
                          {formData.receiveCurrency !== formData.senderCurrency && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Exchange Rate</span>
                              <span className="font-medium">1 {formData.receiveCurrency} = {senderSymbol}{getExchangeRate().toLocaleString()} {formData.senderCurrency}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="h-px bg-border" />
                        
                        <div className="flex justify-between pt-1">
                          <span className="font-medium">Sender Pays</span>
                          <span className="font-bold text-lg text-teal">
                            {formData.receiveAmount && parseFloat(formData.receiveAmount) > 0 
                              ? `${senderSymbol}${(parseFloat(formData.receiveAmount) * getExchangeRate() * 1.03).toFixed(2)} ${formData.senderCurrency}`
                              : `0.00 ${formData.senderCurrency}`}
                          </span>
                        </div>
                        
                        <div className="flex justify-between bg-primary/5 -mx-5 px-5 py-3 -mb-5 rounded-b-xl border-t border-primary/10">
                          <span className="font-medium">You Receive</span>
                          <span className="font-bold text-lg text-primary">
                            {formData.receiveAmount && parseFloat(formData.receiveAmount) > 0 
                              ? `${receiveSymbol}${parseFloat(formData.receiveAmount).toFixed(2)} ${formData.receiveCurrency}`
                              : `0.00 ${formData.receiveCurrency}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-4">
                      <div className="space-y-2 relative">
                        <Label>Search Existing Sender</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            ref={searchInputRef}
                            placeholder="Type name or email to search..."
                            value={senderSearch}
                            onChange={(e) => {
                              setSenderSearch(e.target.value);
                              setShowSenderSuggestions(true);
                            }}
                            onFocus={() => setShowSenderSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSenderSuggestions(false), 150)}
                            className="pl-9 bg-primary/5 border-primary/20"
                            data-testid="input-sender-search"
                            autoComplete="off"
                          />
                        </div>
                        <AnimatePresence>
                          {showSenderSuggestions && senderSearch && filteredSenders.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-56 overflow-auto"
                            >
                              {filteredSenders.map((sender) => (
                                <button
                                  key={sender.email}
                                  type="button"
                                  className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 border-b last:border-b-0"
                                  onClick={() => selectKnownSender(sender)}
                                  data-testid={`suggestion-sender-${sender.email.replace(/[@.]/g, '-')}`}
                                >
                                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{sender.firstName} {sender.middleName} {sender.lastName}</p>
                                    <p className="text-xs text-muted-foreground">{sender.email}</p>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <p className="text-xs text-muted-foreground">Select an existing sender or enter new details below</p>
                      </div>

                      <div className="h-px bg-border" />

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="senderFirstName">First Name *</Label>
                          <Input
                            id="senderFirstName"
                            placeholder="First name"
                            value={formData.senderFirstName}
                            onChange={(e) => handleInputChange("senderFirstName", e.target.value)}
                            data-testid="input-sender-first-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="senderMiddleName">Middle Name</Label>
                          <Input
                            id="senderMiddleName"
                            placeholder="Middle name"
                            value={formData.senderMiddleName}
                            onChange={(e) => handleInputChange("senderMiddleName", e.target.value)}
                            data-testid="input-sender-middle-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="senderLastName">Last Name</Label>
                          <Input
                            id="senderLastName"
                            placeholder="Last name"
                            value={formData.senderLastName}
                            onChange={(e) => handleInputChange("senderLastName", e.target.value)}
                            data-testid="input-sender-last-name"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="senderEmail">Sender Email Address *</Label>
                        <Input
                          id="senderEmail"
                          type="email"
                          placeholder="We'll send the payment link here"
                          value={formData.senderEmail}
                          onChange={(e) => handleInputChange("senderEmail", e.target.value)}
                          data-testid="input-sender-email"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="senderPhone">Sender Mobile Number (Optional)</Label>
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
                            placeholder="Mobile number"
                            value={formData.senderPhone}
                            onChange={(e) => handleInputChange("senderPhone", e.target.value)}
                            className="flex-1"
                            data-testid="input-sender-phone"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="senderDob">Sender Date of Birth (Optional)</Label>
                        <Input
                          id="senderDob"
                          type="date"
                          value={formData.senderDob}
                          onChange={(e) => handleInputChange("senderDob", e.target.value)}
                          data-testid="input-sender-dob"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reason">Reason for Payment (Optional)</Label>
                        <Select
                          value={formData.reason}
                          onValueChange={(value) => handleInputChange("reason", value)}
                        >
                          <SelectTrigger id="reason" data-testid="select-reason">
                            <SelectValue placeholder="Select a reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="family_support">Family Support</SelectItem>
                            <SelectItem value="education_fees">Education Fees</SelectItem>
                            <SelectItem value="medical_expenses">Medical Expenses</SelectItem>
                            <SelectItem value="rent_payment">Rent Payment</SelectItem>
                            <SelectItem value="business_payment">Business Payment</SelectItem>
                            <SelectItem value="gift">Gift</SelectItem>
                            <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
                            <SelectItem value="travel_expenses">Travel Expenses</SelectItem>
                            <SelectItem value="invoice_payment">Invoice Payment</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.paymentMethod === "bank_transfer" && (
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
                          <p className="text-sm font-medium text-muted-foreground">Payer's Bank Details (Optional)</p>
                          <div className="space-y-2">
                            <Label htmlFor="bankAccountName">Account Name</Label>
                            <Input
                              id="bankAccountName"
                              placeholder="Name on account"
                              value={formData.bankAccountName}
                              onChange={(e) => handleInputChange("bankAccountName", e.target.value)}
                              data-testid="input-bank-account-name"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="bankSortCode">Sort Code</Label>
                              <Input
                                id="bankSortCode"
                                placeholder="00-00-00"
                                value={formData.bankSortCode}
                                onChange={(e) => handleInputChange("bankSortCode", e.target.value)}
                                data-testid="input-bank-sort-code"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bankAccountNumber">Account Number</Label>
                              <Input
                                id="bankAccountNumber"
                                placeholder="12345678"
                                value={formData.bankAccountNumber}
                                onChange={(e) => handleInputChange("bankAccountNumber", e.target.value)}
                                data-testid="input-bank-account-number"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-2 lg:self-start lg:sticky lg:top-6">
                      <div className="border-2 border-primary/20 rounded-xl p-5 space-y-4 bg-white" data-testid="fee-breakdown-step2">
                        <h3 className="font-semibold text-lg">Amount</h3>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">You Request</span>
                            <span className="font-medium">
                              {formData.receiveAmount && parseFloat(formData.receiveAmount) > 0 
                                ? `${receiveSymbol}${parseFloat(formData.receiveAmount).toFixed(2)} ${formData.receiveCurrency}`
                                : `0.00 ${formData.receiveCurrency}`}
                            </span>
                          </div>
                          
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Fee (3%)</span>
                            <span className="font-medium">
                              {formData.receiveAmount && parseFloat(formData.receiveAmount) > 0 
                                ? `${senderSymbol}${(parseFloat(formData.receiveAmount) * getExchangeRate() * 0.03).toFixed(2)} ${formData.senderCurrency}`
                                : `0.00 ${formData.senderCurrency}`}
                            </span>
                          </div>

                          {formData.senderCurrency !== formData.receiveCurrency && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Exchange Rate</span>
                              <span className="font-medium">1 {formData.senderCurrency} = {(1 / getExchangeRate()).toFixed(4)} {formData.receiveCurrency}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="h-px bg-border" />
                        
                        <div className="flex justify-between pt-1">
                          <span className="font-medium">Sender Pays</span>
                          <span className="font-bold text-lg text-teal">
                            {formData.receiveAmount && parseFloat(formData.receiveAmount) > 0 
                              ? `${senderSymbol}${senderPays} ${formData.senderCurrency}`
                              : `0.00 ${formData.senderCurrency}`}
                          </span>
                        </div>
                        
                        <div className="flex justify-between bg-primary/5 -mx-5 px-5 py-3 -mb-5 rounded-b-xl border-t border-primary/10">
                          <span className="font-medium">You Receive</span>
                          <span className="font-bold text-lg text-primary">
                            {formData.receiveAmount && parseFloat(formData.receiveAmount) > 0 
                              ? `${receiveSymbol}${parseFloat(formData.receiveAmount).toFixed(2)} ${formData.receiveCurrency}`
                              : `0.00 ${formData.receiveCurrency}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <>
                    <div className="bg-gradient-to-br from-primary/5 to-teal/5 rounded-xl p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">You Receive</p>
                          <p className="text-2xl font-bold text-primary">{receiveSymbol}{parseFloat(formData.receiveAmount || "0").toFixed(2)} {formData.receiveCurrency}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Sender Pays</p>
                          <p className="text-2xl font-bold text-teal">{senderSymbol}{senderPays} {formData.senderCurrency}</p>
                        </div>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="space-y-2">
                        {selectedPayoutAccount && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Payout Account</span>
                            <span className="font-medium">{selectedPayoutAccount.bank} (****{selectedPayoutAccount.accountNumber.slice(-4)})</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Sender Name</span>
                          <span className="font-medium">{[formData.senderFirstName, formData.senderMiddleName, formData.senderLastName].filter(Boolean).join(" ")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Sender Email</span>
                          <span className="font-medium">{formData.senderEmail}</span>
                        </div>
                        {formData.senderPhone && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sender Phone</span>
                            <span className="font-medium">{formData.senderCountryCode} {formData.senderPhone}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Payment Method</span>
                          <span className="font-medium capitalize">{formData.paymentMethod.replace("_", " ")}</span>
                        </div>
                        {formData.reason && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Reason</span>
                            <span className="font-medium capitalize">{formData.reason.replace(/_/g, " ")}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        <strong>Important:</strong> Kindly contact your sender to ensure this request comes from you. This helps prevent fraud and keeps your transactions secure.
                      </p>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
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
                    {currentStep === 4 ? "Send Request" : "Continue"}
                    {currentStep < 4 && <ArrowRight className="w-4 h-4 ml-2" />}
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
